"""
Base centralizzata per SQLAlchemy.
Questo modulo fornisce funzioni e classi per configurare e utilizzare SQLAlchemy
in modo coerente in tutta l'applicazione.
"""
import logging
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import MetaData
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DATABASE_URL

# Configura il logging
logger = logging.getLogger(__name__)

# Funzione per creare una base SQLAlchemy con schema preconfigurato
def create_base_for_schema(schema_name):
    """
    Crea una base SQLAlchemy con schema preconfigurato.
    
    Args:
        schema_name (str): Nome dello schema da utilizzare
        
    Returns:
        tuple: (Base, engine, SessionLocal) - classi e oggetti configurati per SQLAlchemy
    """
    logger.info(f"Configurando SQLAlchemy per lo schema: {schema_name}")
    
    # Crea i metadata con lo schema predefinito
    metadata = MetaData(schema=schema_name)
    
    # Costruisci la stringa di connessione
    if DATABASE_URL:
        engine_url = DATABASE_URL
    else:
        engine_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    # Mostra info di connessione
    masked_url = engine_url
    if DB_PASSWORD:
        masked_url = engine_url.replace(DB_PASSWORD, "***")
    logger.info(f"Connessione database: {masked_url}")
    
    # Crea il motore SQLAlchemy
    engine = create_engine(engine_url)
    
    # Configura l'event listener per impostare lo schema corretto
    @event.listens_for(engine, "connect")
    def set_search_path(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute(f"SET search_path TO {schema_name}, public")
        cursor.close()
    
    # Base per i modelli SQLAlchemy con i metadata preconfigurati
    Base = declarative_base(metadata=metadata)
    
    # Crea una factory di sessioni
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    return Base, engine, SessionLocal

# Funzione per garantire che lo schema esista
def ensure_schema_exists(engine, schema_name):
    """
    Verifica che lo schema esista e lo crea se necessario.
    
    Args:
        engine: SQLAlchemy engine
        schema_name (str): Nome dello schema da verificare/creare
    """
    from sqlalchemy import text
    
    with engine.connect() as conn:
        result = conn.execute(text(f"SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = '{schema_name}')"))
        schema_exists = result.scalar()
        
        if not schema_exists:
            logger.warning(f"Lo schema {schema_name} non esiste! Verrà creato automaticamente.")
            conn.execute(text(f"CREATE SCHEMA {schema_name}"))
            conn.commit()
        else:
            logger.info(f"Schema {schema_name} già esistente")

# Funzione per creare una sessione SQLAlchemy
def get_db_session(SessionLocal):
    """
    Context manager per ottere una sessione del database.
    
    Args:
        SessionLocal: SQLAlchemy sessionmaker
    
    Yields:
        Session: Sessione SQLAlchemy
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()