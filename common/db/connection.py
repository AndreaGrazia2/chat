import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

def get_db_connection(schema="chat_schema"):
    """Crea una connessione al database con lo schema specificato"""
    connection = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    connection.autocommit = False
    return connection

@contextmanager
def get_db_cursor(commit=False, schema="chat_schema"):
    """Context manager per ottenere un cursore DB con lo schema specificato"""
    connection = None
    try:
        connection = get_db_connection()
        # Usa RealDictCursor per avere i risultati come dizionari
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        # Imposta lo schema corretto
        cursor.execute(f"SET search_path TO {schema}, public")
        
        yield cursor
        
        if commit:
            connection.commit()
    except Exception as e:
        if connection:
            connection.rollback()
        raise e
    finally:
        if connection:
            connection.close()