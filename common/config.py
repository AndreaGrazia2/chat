import os
import logging
from dotenv import load_dotenv

# Configura il logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Carica le variabili d'ambiente solo se il file .env esiste
if os.path.exists('.env'):
    logger.info("Caricando le variabili d'ambiente dal file .env")
    load_dotenv()
else:
    logger.info("File .env non trovato, utilizzo le variabili d'ambiente del sistema")

# Flag di debug - 'True' o 'False', con fallback a False se non impostato
DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')

# Chiave segreta per Flask
SECRET_KEY = os.getenv('SECRET_KEY', 'dev_key')

# Ambiente (development o production)
FLASK_ENV = os.getenv('FLASK_ENV', 'production' if not DEBUG else 'development')

# Porta su cui eseguire l'applicazione
# Porta su cui eseguire l'applicazione
if FLASK_ENV == 'development':
    PORT = int(os.getenv('PORT', 5000))
    API_BASE_URL = f"http://localhost:{PORT}"
else:
    # In produzione (come su Render) usa la porta fornita dall'ambiente o 10000 come fallback
    PORT = int(os.getenv('PORT', 10000))
    API_BASE_URL = os.getenv('API_BASE_URL', f"http://localhost:{PORT}")

DATABASE_URL = os.getenv('DATABASE_URL', '')

# Database
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'agent_db')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_SCHEMA = os.getenv('DB_SCHEMA', 'workflow_agent')

# Schema specifici per moduli
CHAT_SCHEMA = os.getenv('CHAT_SCHEMA', 'chat_schema')
CAL_SCHEMA = os.getenv('CAL_SCHEMA', 'cal_schema')

# API Keys
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Stampa le informazioni di configurazione all'avvio
def log_config_info():
    """Registra le informazioni di configurazione"""
    logger.info(f"Ambiente: {'Development' if DEBUG else 'Production'}")
    logger.info(f"FLASK_ENV: {FLASK_ENV}")
    logger.info(f"PORT: {PORT}")
    logger.info(f"API_BASE_URL: {API_BASE_URL}")
    logger.info(f"DATABASE: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    logger.info(f"DB_SCHEMA principale: {DB_SCHEMA}")
    logger.info(f"CHAT_SCHEMA: {CHAT_SCHEMA}")
    logger.info(f"CAL_SCHEMA: {CAL_SCHEMA}")
    
    # Log delle API keys in modo sicuro (solo prime 5 e ultime 4 caratteri)
    def mask_key(key):
        if not key or len(key) < 10:
            return "Not configured"
        return f"{key[:5]}...{key[-4:]}"
    
    logger.info(f"OPENROUTER_API_KEY: {mask_key(OPENROUTER_API_KEY)}")
    logger.info(f"OPENAI_API_KEY: {mask_key(OPENAI_API_KEY)}")