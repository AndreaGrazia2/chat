import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import logging
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, CHAT_SCHEMA, CAL_SCHEMA

# Configura il logging
logger = logging.getLogger(__name__)

def get_db_connection():
    """Crea una connessione al database"""
    try:
        # Controlla se è presente una stringa di connessione completa
        if DATABASE_URL:
            connection = psycopg2.connect(DATABASE_URL)
        else:
            # Altrimenti usa i parametri separati
            connection = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD
            )
        connection.autocommit = False
        return connection
    except Exception as e:
        logger.error(f"Errore nella connessione al database: {str(e)}")
        raise

@contextmanager
def get_db_cursor(commit=False, schema=CHAT_SCHEMA):
    """
    Context manager per ottenere un cursore DB con lo schema specificato
    
    Args:
        commit (bool): Se True, commit automaticamente al termine dell'operazione
        schema (str): Schema da utilizzare, default a CHAT_SCHEMA
    """
    connection = None
    try:
        connection = get_db_connection()
        # Usa RealDictCursor per avere i risultati come dizionari
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        
        # Garantisci che lo schema esista
        cursor.execute(
            f"SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = %s)",
            (schema,)
        )
        schema_exists = cursor.fetchone()['exists']
        
        if not schema_exists:
            logger.warning(f"Lo schema {schema} non esiste! Verrà creato automaticamente.")
            cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")
            connection.commit()
        
        # Imposta lo schema corretto
        cursor.execute(f"SET search_path TO {schema}, public")
        
        yield cursor
        
        if commit:
            connection.commit()
    except Exception as e:
        logger.error(f"Errore durante l'operazione sul database: {str(e)}")
        if connection:
            connection.rollback()
        raise
    finally:
        if connection:
            connection.close()

def get_chat_db_cursor(commit=False):
    """Helper per ottenere un cursore specifico per lo schema chat"""
    return get_db_cursor(commit=commit, schema=CHAT_SCHEMA)

def get_cal_db_cursor(commit=False):
    """Helper per ottenere un cursore specifico per lo schema calendar"""
    return get_db_cursor(commit=commit, schema=CAL_SCHEMA)