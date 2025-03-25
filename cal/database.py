import os
import logging
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DATABASE_URL, CAL_SCHEMA

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Schema fisso per il modulo calendario - usando la variabile centralizzata
DB_SCHEMA = CAL_SCHEMA  # Definito direttamente qui invece di importarlo

# Costruisci la stringa di connessione
if DATABASE_URL:
    # Non modificare la URL per Neon
    ENGINE_URL = DATABASE_URL
else:
    ENGINE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Prima di creare il motore SQLAlchemy
logger.info(f"DATABASE_URL: {'Presente' if DATABASE_URL else 'Non impostato'}")
logger.info(f"Usando ENGINE_URL: {ENGINE_URL.split('@')[0].replace(DB_PASSWORD, '***')}@{ENGINE_URL.split('@')[1]}")

try:
    # Crea il motore SQLAlchemy senza specificare search_path nelle opzioni di connessione
    engine = create_engine(ENGINE_URL)
    
    # Imposta lo schema dopo la connessione mediante un event listener
    @event.listens_for(engine, "connect")
    def set_search_path(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute(f"SET search_path TO {DB_SCHEMA}, public")
        cursor.close()
    
    # Crea una factory di sessioni
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Base per i modelli SQLAlchemy
    Base = declarative_base()
    
    logger.info(f"Connessione al database configurata: {DB_HOST}:{DB_PORT}/{DB_NAME} (schema={DB_SCHEMA})")
except Exception as e:
    logger.error(f"Errore nella configurazione del database: {str(e)}")
    raise

def get_db():
    """
    Funzione helper per ottenere una sessione del database.
    Da utilizzare come dipendenza nelle route FastAPI/Flask.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()