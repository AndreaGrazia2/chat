import os
import sys
import logging
import sqlalchemy
from sqlalchemy import text
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, CAL_SCHEMA
from common.db.connection import get_engine, ensure_schema_exists

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Funzione per inizializzare il database
def init_db():
    # Schema fisso per il modulo calendario - usando la variabile centralizzata
    DB_SCHEMA = CAL_SCHEMA
    
    try:
        # Crea un motore SQLAlchemy
        engine = get_engine()
        
        # Assicura che lo schema esista
        ensure_schema_exists(engine, DB_SCHEMA)
        
        # Leggi il file SQL con lo schema del database
        schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
        with open(schema_path, 'r') as file:
            sql_schema = file.read()
        
        # Esegui lo script SQL
        with engine.connect() as conn:
            conn.execute(text(f"SET search_path TO {DB_SCHEMA}, public"))
            
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
    sys.exit(0 if success else 1)