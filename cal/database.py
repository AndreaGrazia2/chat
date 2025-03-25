import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import logging

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Carica le variabili d'ambiente dal file .env (solo in ambiente locale)
# In produzione su Render, le variabili d'ambiente sono configurate nella piattaforma
if os.path.exists('.env'):
    load_dotenv()

# Configurazione del database
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "agent_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_SCHEMA = "cal_schema"  # Schema fisso per il modulo calendario

# Costruisci la stringa di connessione
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    # Crea il motore SQLAlchemy con lo schema specificato
    engine = create_engine(DATABASE_URL, connect_args={"options": f"-csearch_path={DB_SCHEMA}"})
    
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