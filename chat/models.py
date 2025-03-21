import random
from datetime import datetime, timedelta

# Contatore globale per gli ID dei messaggi
message_id_counter = 1000

# Utenti predefiniti
users = [
    {"id": 1, "name": "You", "avatar": "https://i.pravatar.cc/150?img=1", "status": "online"},
    {"id": 2, "name": "John Doe", "avatar": "https://i.pravatar.cc/150?img=2", "status": "online"},
    {"id": 3, "name": "Jane Smith", "avatar": "https://i.pravatar.cc/150?img=3", "status": "away"},
    {"id": 4, "name": "Mike Johnson", "avatar": "https://i.pravatar.cc/150?img=4", "status": "busy"},
    {"id": 5, "name": "Emma Davis", "avatar": "https://i.pravatar.cc/150?img=5", "status": "offline"},
]

# Canali predefiniti
channels = [
    {"id": 1, "name": "general"},
    {"id": 2, "name": "random"},
    {"id": 3, "name": "announcements"},
    {"id": 4, "name": "development"}
]

# Messaggi di esempio per i test
message_texts = [
    'Hey there!',
    'How are you doing today?',
    'Did you check out the new feature?',
    # ... altri messaggi di esempio ...
    'The user feedback for the new UI has been mostly positive.'
]

# Tipi di file per gli allegati
file_types = [
    {
        "ext": "pdf",
        "icon": "fa-file-pdf",
        "name": "Presentation",
        "size": "2.4 MB"
    },
    # ... altri tipi di file ...
]

# Struttura dati per i messaggi
messages = {
    "channels": {},
    "directMessages": {}
}

# Struttura per il rate limiting
last_llm_requests = {}

def rate_limit_llm_request(user_id):
    """
    Verifica se una richiesta LLM per lo stesso utente è stata effettuata troppo recentemente.
    Restituisce True se la richiesta dovrebbe essere bloccata, False altrimenti.
    """
    global last_llm_requests
    
    current_time = datetime.now().timestamp()
    last_request_time = last_llm_requests.get(user_id, 0)
    
    # Blocca richieste troppo frequenti (meno di 2 secondi tra una richiesta e l'altra)
    if current_time - last_request_time < 2:
        print(f"Rate limiting LLM request for user {user_id}")
        return True
    
    # Aggiorna il timestamp dell'ultima richiesta
    last_llm_requests[user_id] = current_time
    return False

