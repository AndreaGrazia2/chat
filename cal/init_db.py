import os
import sys
import logging
import sqlalchemy
from sqlalchemy import text
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Funzione per inizializzare il database
def init_db():
    # Configurazione del database
    # Costruisci la stringa di connessione
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    try:
        # Crea una connessione al database
        engine = sqlalchemy.create_engine(DATABASE_URL)
        
        # Controlla se lo schema cal_schema esiste
        with engine.connect() as conn:
            result = conn.execute(text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'cal_schema'"))
            schema_exists = result.fetchone() is not None
            
            if not schema_exists:
                logger.info("Lo schema 'cal_schema' non esiste, creando...")
                conn.execute(text("CREATE SCHEMA cal_schema"))
                conn.commit()
            else:
                logger.info("Lo schema 'cal_schema' esiste già")
        
        # Leggi il file SQL con lo schema del database
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, 'r') as file:
            sql_schema = file.read()
        
        # Esegui lo script SQL
        with engine.connect() as conn:
            conn.execute(text("SET search_path TO cal_schema, public"))
            
            # Dividi lo script in singole istruzioni SQL
            # Nota: questo è un approccio semplificato, potrebbe non funzionare con SQL complessi
            statements = sql_schema.split(';')
            
            for stmt in statements:
                if stmt.strip():
                    try:
                        conn.execute(text(stmt))
                        conn.commit()
                    except Exception as e:
                        logger.warning(f"Errore nell'esecuzione dell'istruzione SQL: {e}")
                        # Continua con la prossima istruzione
            
            logger.info("Schema del database inizializzato con successo")
            
        return True
    
    except Exception as e:
        logger.error(f"Errore durante l'inizializzazione del database: {str(e)}")
        return False

if __name__ == "__main__":
    success = init_db()