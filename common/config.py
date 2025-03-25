import os
from dotenv import load_dotenv

# Carica le variabili d'ambiente solo se il file .env esiste
if os.path.exists('.env'):
    load_dotenv()

# Flag di debug - 'True' o 'False', con fallback a False se non impostato
DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')

# Chiave segreta per Flask
SECRET_KEY = os.getenv('SECRET_KEY', 'dev_key')

# Ambiente (development o production)
FLASK_ENV = os.getenv('FLASK_ENV', 'production' if not DEBUG else 'development')

# Porta su cui eseguire l'applicazione
PORT = int(os.getenv('PORT', 5000))

# Database
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'agent_db')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_SCHEMA = os.getenv('DB_SCHEMA', 'public')

# API Keys
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Stampa le informazioni di configurazione all'avvio
def log_config_info():
    """Registra le informazioni di configurazione"""
    print(f"Ambiente: {'Development' if DEBUG else 'Production'}")
    print(f"DATABASE: {DB_HOST}:{DB_PORT}/{DB_NAME} (schema={DB_SCHEMA})")
    print(f"FLASK_ENV: {FLASK_ENV}")
    print(f"PORT: {PORT}")
    
    # Log delle API keys in modo sicuro (solo prime 5 e ultime 4 caratteri)
    def mask_key(key):
        if not key or len(key) < 10:
            return "Not configured"
        return f"{key[:5]}...{key[-4:]}"
    
    print(f"OPENROUTER_API_KEY: {mask_key(OPENROUTER_API_KEY)}")
    print(f"OPENAI_API_KEY: {mask_key(OPENAI_API_KEY)}")