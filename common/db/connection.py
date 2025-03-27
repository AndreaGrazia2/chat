"""
Utility di connessione al database basate su SQLAlchemy.
Sostituisce le vecchie funzioni che utilizzavano psycopg2 con equivalenti SQLAlchemy.
"""
import logging
import time  # Add this import for sleep function
from contextlib import contextmanager
from sqlalchemy import create_engine, text, event
from sqlalchemy.exc import OperationalError, DisconnectionError  # Add these imports
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
        
        # Parametri di connessione migliorati per Render
        connect_args = {
            "connect_timeout": 60,  # Aumentato il timeout di connessione
            "keepalives": 1,
            "keepalives_idle": 20,  # Ridotto il tempo di inattività
            "keepalives_interval": 5,  # Intervalli più frequenti
            "keepalives_count": 5,
            "application_name": "myapp",  # Aiuta a identificare la tua app nei log
            "sslmode": "require",  # Assicurati di usare SSL
        }
        
        # Crea il motore SQLAlchemy con parametri migliorati
        engine = create_engine(
            engine_url, 
            connect_args=connect_args,
            pool_pre_ping=True,
            pool_recycle=60,        # Ricicla le connessioni più frequentemente (ogni minuto)
            pool_timeout=30,
            pool_size=5,            # Limita il numero di connessioni
            max_overflow=10
        )
        
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
    """Context manager per ottenere una sessione del database con gestione degli errori migliorata"""
    session = session_factory()
    max_retries = 3
    retry_count = 0
    retry_delay = 2  # Aumentare il tempo di attesa tra i tentativi
    
    try:
        while retry_count < max_retries:
            try:
                yield session
                session.commit()
                break
            except (OperationalError, DisconnectionError) as e:
                retry_count += 1
                session.rollback()
                
                if retry_count >= max_retries:
                    logger.error(f"Errore di connessione al database dopo {max_retries} tentativi: {str(e)}")
                    raise
                
                logger.warning(f"Errore di connessione al database, tentativo {retry_count}/{max_retries}: {str(e)}")
                time.sleep(retry_delay * retry_count)  # Attesa esponenziale
            except Exception as e:
                logger.error(f"Errore durante l'operazione sul database: {str(e)}")
                session.rollback()
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

