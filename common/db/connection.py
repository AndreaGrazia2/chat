"""
Utility di connessione al database basate su SQLAlchemy.
Sostituisce le vecchie funzioni che utilizzavano psycopg2 con equivalenti SQLAlchemy.
"""
import logging
from contextlib import contextmanager
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, CHAT_SCHEMA, CAL_SCHEMA, DATABASE_URL

# Configura il logging
logger = logging.getLogger(__name__)

def get_engine(schema=None):
    """
    Crea un motore SQLAlchemy con schema opzionale.
    
    Args:
        schema (str, optional): Nome dello schema da utilizzare
    
    Returns:
        Engine: Motore SQLAlchemy configurato
    """
    try:
        # Costruisci la stringa di connessione
        if DATABASE_URL:
            engine_url = DATABASE_URL
        else:
            engine_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        
        # Mostra info di connessione (maschera la password)
        masked_url = engine_url
        if DB_PASSWORD:
            masked_url = engine_url.replace(DB_PASSWORD, "***")
        logger.info(f"Connessione database: {masked_url}")
        
        # Crea il motore SQLAlchemy
        engine = create_engine(engine_url)
        
        # Imposta lo schema se specificato
        if schema:
            @event.listens_for(engine, "connect")
            def set_search_path(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute(f"SET search_path TO {schema}, public")
                cursor.close()
        
        return engine
    except Exception as e:
        logger.error(f"Errore nella creazione del motore SQLAlchemy: {str(e)}")
        raise

def create_session_factory(engine):
    """
    Crea una factory di sessioni SQLAlchemy.
    
    Args:
        engine: Motore SQLAlchemy
    
    Returns:
        sessionmaker: Factory di sessioni SQLAlchemy
    """
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)

@contextmanager
def get_db_session(session_factory):
    """
    Context manager per ottenere una sessione del database.
    
    Args:
        session_factory: Factory di sessioni SQLAlchemy
    
    Yields:
        Session: Sessione SQLAlchemy
    """
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Errore durante l'operazione sul database: {str(e)}")
        raise
    finally:
        session.close()

def ensure_schema_exists(engine, schema_name):
    """
    Verifica che lo schema esista e lo crea se necessario.
    
    Args:
        engine: Motore SQLAlchemy
        schema_name (str): Nome dello schema da verificare/creare
    """
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '{schema_name}')"))
        schema_exists = result.scalar()
        
        if not schema_exists:
            logger.warning(f"Lo schema {schema_name} non esiste! Verrà creato automaticamente.")
            conn.execute(text(f"CREATE SCHEMA {schema_name}"))
            conn.commit()
        else:
            logger.info(f"Schema {schema_name} già esistente")

# Funzioni di compatibilità retroattiva (opzionali)
# Queste funzioni mantengono la stessa interfaccia delle funzioni originali
# ma usano internamente SQLAlchemy invece di psycopg2

def get_chat_db_session():
    """
    Helper per ottenere una sessione SQLAlchemy per lo schema chat.
    
    Yields:
        Session: Sessione SQLAlchemy per lo schema chat
    """
    engine = get_engine(schema=CHAT_SCHEMA)
    ensure_schema_exists(engine, CHAT_SCHEMA)
    session_factory = create_session_factory(engine)
    with get_db_session(session_factory) as session:
        yield session

def get_cal_db_session():
    """
    Helper per ottenere una sessione SQLAlchemy per lo schema calendar.
    
    Yields:
        Session: Sessione SQLAlchemy per lo schema calendar
    """
    engine = get_engine(schema=CAL_SCHEMA)
    ensure_schema_exists(engine, CAL_SCHEMA)
    session_factory = create_session_factory(engine)
    with get_db_session(session_factory) as session:
        yield session