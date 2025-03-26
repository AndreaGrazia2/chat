import os
import json
import logging
from datetime import datetime

# Configurazione del logger
def setup_logger(name, level=logging.INFO):
    """Setup di un logger configurato"""
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Crea un handler che scrive i log su console
    handler = logging.StreamHandler()
    handler.setLevel(level)
    
    # Crea un formatter per i messaggi di log
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    
    # Aggiungi l'handler al logger
    logger.addHandler(handler)
    
    return logger

# Funzione per ottenere una risposta dal modello LLM
def get_llm_response(message_text):
    """
    Proxy per la funzione get_llm_response di chat.handlers.
    Assicura che l'import sia lazy per evitare dipendenze circolari.
    """
    from chat.handlers import get_llm_response as _get_llm_response
    return _get_llm_response(message_text)

# Utility per la serializzazione JSON di tipi complessi
class CustomJSONEncoder(json.JSONEncoder):
    """Encoder JSON personalizzato che gestisce tipi speciali come datetime"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def safe_json(data):
    """Converte in modo sicuro un oggetto in una stringa JSON"""
    return json.dumps(data, cls=CustomJSONEncoder)

# Utility per i percorsi file
def get_app_root():
    """Restituisce il percorso assoluto della directory principale dell'app"""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_path(relative_path):
    """Costruisce un percorso assoluto a partire da uno relativo"""
    return os.path.join(get_app_root(), relative_path)