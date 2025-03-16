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

def generate_test_messages():
    """Genera messaggi di test per tutti i canali"""
    global message_id_counter

    # Genera messaggi di test per tutti i canali
    for channel in channels:
        channel_name = channel["name"]
        messages["channels"][channel_name] = []

        # Aggiungi 20-30 messaggi casuali per canale
        num_messages = random.randint(20, 30)
        for i in range(num_messages):
            # Crea un messaggio casuale
            message_id_counter += 1
            # Escludi "You" per i messaggi di test
            user_id = random.randint(1, len(users)-1)
            text = random.choice(message_texts)

            # Simula messaggi degli ultimi 7 giorni
            days_ago = random.randint(0, 7)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            timestamp = datetime.now() - timedelta(days=days_ago,
                                                  hours=hours_ago, minutes=minutes_ago)

            # Determina il tipo di messaggio (normale, file, inoltrato)
            message_type = "normal"
            file_data = None
            forwarded_from = None

            rand_val = random.random()
            if rand_val < 0.1:  # 10% di probabilità per un file
                message_type = "file"
                file_data = random.choice(file_types)
            elif rand_val < 0.2:  # 10% di probabilità per un inoltro
                message_type = "forwarded"
                forward_user_id = random.randint(1, len(users)-1)
                forwarded_from = users[forward_user_id]

            # Crea l'oggetto messaggio
            message = {
                "id": message_id_counter,
                "user": users[user_id],
                "text": text,
                "timestamp": timestamp.isoformat(),
                "isOwn": False,
                "type": message_type,
                "fileData": file_data,
                "forwardedFrom": forwarded_from
            }

            messages["channels"][channel_name].append(message)

    # Ordina i messaggi per timestamp
    for channel_name in messages["channels"]:
        messages["channels"][channel_name].sort(key=lambda x: x["timestamp"])

def generate_dm_messages(user_id):
    """Genera messaggi di test per una conversazione diretta"""
    global message_id_counter
    dm_key = f"dm:{user_id}"
    
    if dm_key not in messages["directMessages"]:
        messages["directMessages"][dm_key] = []

        # Genera 5-15 messaggi di test per questa DM
        num_messages = random.randint(5, 15)

        for i in range(num_messages):
            message_id_counter += 1

            # Alterna tra l'utente e "You"
            if i % 2 == 0:
                sender = next((u for u in users if str(u["id"]) == str(user_id)), users[0])
                is_own = False
            else:
                sender = users[0]  # "You"
                is_own = True

            text = random.choice(message_texts)

            # Simula messaggi degli ultimi 7 giorni
            days_ago = random.randint(0, 7)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            timestamp = datetime.now() - timedelta(days=days_ago,
                                                  hours=hours_ago, minutes=minutes_ago)

            # Determina il tipo di messaggio (normale, file, inoltrato)
            message_type = "normal"
            file_data = None
            forwarded_from = None

            rand_val = random.random()
            if rand_val < 0.1:  # 10% di probabilità per un file
                message_type = "file"
                file_data = random.choice(file_types)
            elif rand_val < 0.2:  # 10% di probabilità per un inoltro
                message_type = "forwarded"
                forward_user_id = random.randint(1, len(users)-1)
                while forward_user_id == user_id:  # Non inoltrare dallo stesso utente
                    forward_user_id = random.randint(1, len(users)-1)
                forwarded_from = users[forward_user_id]

            message = {
                "id": message_id_counter,
                "user": sender,
                "text": text,
                "timestamp": timestamp.isoformat(),
                "isOwn": is_own,
                "type": message_type,
                "fileData": file_data,
                "forwardedFrom": forwarded_from
            }

            messages["directMessages"][dm_key].append(message)

        # Ordina i messaggi per timestamp
        messages["directMessages"][dm_key].sort(key=lambda x: x["timestamp"])
    
    return messages["directMessages"][dm_key]

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

# Inizializza i messaggi di test all'avvio
generate_test_messages()