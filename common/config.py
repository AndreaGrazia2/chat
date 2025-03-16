# /Users/giuseppecanale/Lavori/chat/common/config.py
import os
from dotenv import load_dotenv

# Carica le variabili d'ambiente
load_dotenv()

# Configurazione generale
SECRET_KEY = os.getenv('SECRET_KEY', 'dev_key')

# Configurazione OpenRouter API
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "google/gemma-3-27b-it:free"

# Configurazione del server
PORT = int(os.getenv('PORT', 5000))
DEBUG = os.getenv('FLASK_ENV') == 'development'