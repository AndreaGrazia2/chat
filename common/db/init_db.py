"""
Script di inizializzazione per tutti gli schemi del database.
Questo script crea gli schemi e le tabelle per tutti i moduli.
"""
import os
import sys
import logging
import argparse
from sqlalchemy import text

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importa le configurazioni necessarie
from common.config import CHAT_SCHEMA, CAL_SCHEMA

def create_schema(engine, schema_name):
    """Crea uno schema se non esiste già"""
    with engine.connect() as conn:
        # Verifica se lo schema esiste
        result = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '{schema_name}')"))
        schema_exists = result.scalar()
        
        if not schema_exists:
            logger.info(f"Creazione dello schema {schema_name}...")
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
            conn.commit()
            logger.info(f"Schema {schema_name} creato con successo.")
        else:
            logger.info(f"Lo schema {schema_name} esiste già.")

def initialize_chat_schema():
    """Inizializza lo schema e le tabelle per il modulo chat"""
    logger.info("Inizializzazione dello schema per il modulo chat...")
    
    # Importa i moduli necessari
    from chat.database import engine, Base
    
    # Crea lo schema
    create_schema(engine, CHAT_SCHEMA)
    
    # Crea tutte le tabelle
    Base.metadata.create_all(engine)
    
    logger.info("Tabelle del modulo chat create con successo.")
    
    # Carica i dati di base se necessario
    seed_chat_data(engine)

def initialize_cal_schema():
    """Inizializza lo schema e le tabelle per il modulo calendario"""
    logger.info("Inizializzazione dello schema per il modulo calendario...")
    
    # Importa i moduli necessari
    from cal.database import engine, Base
    
    # Crea lo schema
    create_schema(engine, CAL_SCHEMA)
    
    # Crea tutte le tabelle
    Base.metadata.create_all(engine)
    
    logger.info("Tabelle del modulo calendario create con successo.")
    
    # Carica i dati di base se necessario
    seed_calendar_data(engine)

def seed_chat_data(engine):
    """Carica i dati di base per il modulo chat"""
    logger.info("Caricamento dei dati di base per il modulo chat...")
    
    # Importa i modelli
    from chat.models import User
    from chat.database import SessionLocal
    
    db = SessionLocal()
    
    try:
        # Verifica se ci sono già utenti
        user_count = db.query(User).count()
        
        if user_count == 0:
            # Crea utenti base
            users = [
                User(id=1, username="owner", display_name="Owner", 
                     avatar_url="https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff", 
                     status="online"),
                User(id=2, username="john_doe", display_name="John Doe", 
                     avatar_url="https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff", 
                     status="online")
            ]
            
            db.add_all(users)
            db.commit()
            
            logger.info("Dati di base per il modulo chat caricati con successo.")
        else:
            logger.info("I dati di base per il modulo chat sono già presenti.")
    except Exception as e:
        db.rollback()
        logger.error(f"Errore durante il caricamento dei dati di base per il modulo chat: {str(e)}")
    finally:
        db.close()

def seed_calendar_data(engine):
    """Carica i dati di base per il modulo calendario"""
    logger.info("Caricamento dei dati di base per il modulo calendario...")
    
    # Qui puoi caricare dati di base come le categorie di eventi
    # Simile a seed_chat_data ma per il modulo calendario
    
    # Per ora, utilizziamo uno script SQL separato per inizializzare i dati di base
    try:
        schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'cal/schema.sql')
        
        # Verifica che il file schema.sql esista
        if os.path.exists(schema_path):
            logger.info(f"Esecuzione dello script SQL: {schema_path}")
            
            # Leggi il file SQL
            with open(schema_path, 'r') as file:
                sql_schema = file.read()
            
            # Esegui lo script SQL
            with engine.connect() as conn:
                conn.execute(text(f"SET search_path TO {CAL_SCHEMA}, public"))
                
                # Dividi lo script in singole istruzioni SQL
                statements = sql_schema.split(';')
                
                for stmt in statements:
                    if stmt.strip():
                        try:
                            conn.execute(text(stmt))
                            conn.commit()
                        except Exception as e:
                            logger.warning(f"Errore nell'esecuzione dell'istruzione SQL: {e}")
                            # Continua con la prossima istruzione
                
                logger.info("Script SQL eseguito con successo.")
        else:
            logger.warning(f"File schema.sql non trovato in: {schema_path}")
    except Exception as e:
        logger.error(f"Errore durante l'esecuzione dello script SQL: {str(e)}")

def main():
    """Funzione principale"""
    parser = argparse.ArgumentParser(description="Inizializzazione del database")
    parser.add_argument('--module', choices=['all', 'chat', 'cal'], default='all',
                        help='Quale modulo inizializzare (default: all)')
    
    args = parser.parse_args()
    
    if args.module in ['all', 'chat']:
        initialize_chat_schema()
    
    if args.module in ['all', 'cal']:
        initialize_cal_schema()
    
    logger.info("Inizializzazione del database completata con successo.")

if __name__ == "__main__":
    main()