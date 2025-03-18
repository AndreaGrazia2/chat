import os
from dotenv import load_dotenv
from pathlib import Path

# Trova la directory root del progetto (un livello sopra la directory workflow)
root_dir = Path(__file__).parent.parent
# Carica variabili d'ambiente dal file .env nella root
load_dotenv(os.path.join(root_dir, '.env'))

# Configurazione database
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "agent_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Oc7rt11$")
DB_SCHEMA = os.getenv("DB_SCHEMA", "workflow_agent")

# Configurazione OpenRouter API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-3-27b-it:free")

# Compatibilità con codice esistente
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")  # Manteniamo per retrocompatibilità
DEFAULT_LLM_MODEL = os.getenv("DEFAULT_LLM_MODEL", OPENROUTER_MODEL)
DEFAULT_EMBEDDING_MODEL = os.getenv("DEFAULT_EMBEDDING_MODEL", "text-embedding-ada-002")

# Configurazione app
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-change-in-production")