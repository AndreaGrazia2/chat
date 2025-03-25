import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, CAL_SCHEMA

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Schema fisso per il modulo calendario - usando la variabile centralizzata
DB_SCHEMA = CAL_SCHEMA

# Costruisci la stringa di connessione
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

if DATABASE_URL:
    ENGINE_URL = DATABASE_URL
else:
    ENGINE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    # Crea il motore SQLAlchemy con lo schema specificato
    engine = create_engine(ENGINE_URL, connect_args={"options": f"-csearch_path={DB_SCHEMA}"})
    
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