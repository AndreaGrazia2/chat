import os
import json
import random
import requests
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from dotenv import load_dotenv
import time
import sys
sys.setrecursionlimit(1000)  # Imposta un limite di ricorsione sicura

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_key')

socketio = SocketIO(app, cors_allowed_origins="*",
                    async_mode='gevent', ping_timeout=60, ping_interval=25)

# OpenRouter API configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Gestore eccezioni per Flask


@app.errorhandler(Exception)
def handle_exception(e):
    """Gestisce tutte le eccezioni non catturate"""
    # Registra l'errore
    print(f"Errore non gestito: {str(e)}")
    # Se è una richiesta API, restituisce un errore JSON
    if request.path.startswith('/api/'):
        return jsonify({"error": "Internal server error", "message": str(e)}), 500
    # Altrimenti restituisce una pagina di errore
    return render_template('chat.html'), 500

# Gestore errori per Socket.IO


@socketio.on_error()
def error_handler(e):
    """Gestisce le eccezioni durante le operazioni Socket.IO"""
    print(f"Socket.IO error: {str(e)}")

# Function to call OpenRouter API
def get_llm_response(message_text):
    """Versione sicura che previene ricorsioni e gestisce tutti gli errori possibili"""
    if not OPENROUTER_API_KEY:
        return "API key not configured. Please set OPENROUTER_API_KEY in your environment."
    
    # Limita la dimensione dell'input per evitare problemi
    safe_message = str(message_text)[:500] if message_text else ""
    
    try:
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Riduci la complessità dei dati
        data = {
            "model": "google/gemma-3-27b-it:free",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": safe_message}
            ]
        }
        
        # Usa un timeout breve e non utilizzare json direttamente per evitare ricorsioni
        raw_response = requests.post(
            OPENROUTER_API_URL, 
            headers=headers, 
            data=json.dumps(data), 
            timeout=10
        )
        
        # Controlla manualmente il codice di stato
        if raw_response.status_code != 200:
            return f"Error: API returned status code {raw_response.status_code}"
        
        # Analizza manualmente la risposta JSON
        try:
            # Usa loads anziché l'oggetto response.json() per maggiore controllo
            parsed = json.loads(raw_response.text)
            choices = parsed.get('choices', [])
            
            if not choices:
                return "API returned empty choices"
                
            first_choice = choices[0]
            message = first_choice.get('message', {})
            content = message.get('content', '')
            
            # Limita la dimensione dell'output
            return content[:1000] if content else "Empty response from API"
            
        except json.JSONDecodeError:
            return "Error: Could not parse API response as JSON"
            
    except requests.exceptions.Timeout:
        return "API request timed out after 10 seconds"
    except requests.exceptions.ConnectionError:
        return "Error: Could not connect to API"
    except Exception as e:
        # Cattura qualsiasi altra eccezione senza propagarla
        error_type = type(e).__name__
        return f"Unexpected error: {error_type}"

# In-memory data store (replace with a database in production)
users = [
    {"id": 1, "name": "You", "avatar": "https://i.pravatar.cc/150?img=1", "status": "online"},
    {"id": 2, "name": "John Doe",
        "avatar": "https://i.pravatar.cc/150?img=2", "status": "online"},
    {"id": 3, "name": "Jane Smith",
        "avatar": "https://i.pravatar.cc/150?img=3", "status": "away"},
    {"id": 4, "name": "Mike Johnson",
        "avatar": "https://i.pravatar.cc/150?img=4", "status": "busy"},
    {"id": 5, "name": "Emma Davis",
        "avatar": "https://i.pravatar.cc/150?img=5", "status": "offline"},
]

channels = [
    {"id": 1, "name": "general"},
    {"id": 2, "name": "random"},
    {"id": 3, "name": "announcements"},
    {"id": 4, "name": "development"}
]

# Sample message texts for more variety in test messages
message_texts = [
    'Hey there!',
    'How are you doing today?',
    'Did you check out the new feature?',
    'I think we need to discuss this further in the meeting.',
    'Let me know when you are available for a quick call.',
    'The documentation looks good, just a few minor tweaks needed.',
    'Can you help me with this issue I am having?',
    'Great work on the latest release!',
    'I will be out of office tomorrow, can we reschedule?',
    'Just pushed the latest code changes to the repository.',
    'This is a really interesting article about new technologies.',
    'Remember to update your dependencies before running the build.',
    'The client loved our presentation yesterday!',
    'Check out this link: <span class="link-example">https://xbe.at</span> it has amazing content!',
    'Looks like we have a bug in the production environment.',
    'I just finished the design for the new landing page.',
    'Have you tried visiting <span class="link-example">https://xbe.at/blog</span> for the latest updates?',
    'Did you see the latest market trends?',
    'We should implement that feature our users have been requesting.',
    'How about we schedule a brainstorming session?',
    'The API documentation needs to be updated.',
    'I found a more efficient way to solve that problem.',
    'This user research provides some interesting insights.',
    'Our competitors just launched a similar product.',
    'I recommend looking at <span class="link-example">https://xbe.at/docs</span> for reference material.',
    'Thanks for your help with troubleshooting yesterday.',
    'The server migration went smoothly.',
    'We need to optimize the database queries for better performance.',
    'I prepared an agenda for tomorrow meeting.',
    'The user feedback for the new UI has been mostly positive.'
]

# File types for attachment examples
file_types = [
    {
        "ext": "pdf",
        "icon": "fa-file-pdf",
        "name": "Presentation",
        "size": "2.4 MB"
    },
    {
        "ext": "doc",
        "icon": "fa-file-word",
        "name": "Report Document",
        "size": "1.8 MB"
    },
    {
        "ext": "xls",
        "icon": "fa-file-excel",
        "name": "Financial Data",
        "size": "3.2 MB"
    },
    {
        "ext": "zip",
        "icon": "fa-file-archive",
        "name": "Project Files",
        "size": "5.7 MB"
    },
    {
        "ext": "jpg",
        "icon": "fa-file-image",
        "name": "Product Photo",
        "size": "1.2 MB"
    },
    {
        "ext": "mp3",
        "icon": "fa-file-audio",
        "name": "Meeting Recording",
        "size": "4.3 MB"
    },
    {
        "ext": "mp4",
        "icon": "fa-file-video",
        "name": "Tutorial Video",
        "size": "8.5 MB"
    },
    {
        "ext": "txt",
        "icon": "fa-file-alt",
        "name": "Meeting Notes",
        "size": "45 KB"
    }
]

# Store messages by channel and direct messages
messages = {
    "channels": {},
    "directMessages": {}
}

# Message ID counter
message_id_counter = 1000

# Initialize with test messages


def generate_test_messages():
    global message_id_counter

    # Generate test messages for all channels
    for channel in channels:
        channel_name = channel["name"]
        messages["channels"][channel_name] = []

        # Add 20-30 random messages per channel
        num_messages = random.randint(20, 30)
        for i in range(num_messages):
            # Create a random message
            message_id_counter += 1
            # Exclude "You" for test messages
            user_id = random.randint(1, len(users)-1)
            text = random.choice(message_texts)

            # Simulate messages over the last 7 days
            days_ago = random.randint(0, 7)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            timestamp = datetime.now() - timedelta(days=days_ago,
                                                   hours=hours_ago, minutes=minutes_ago)

            # Determine message type (normal, file, forwarded)
            message_type = "normal"
            file_data = None
            forwarded_from = None

            rand_val = random.random()
            if rand_val < 0.1:  # 10% chance for file
                message_type = "file"
                file_data = random.choice(file_types)
            elif rand_val < 0.2:  # 10% chance for forwarded
                message_type = "forwarded"
                forward_user_id = random.randint(1, len(users)-1)
                forwarded_from = users[forward_user_id]

            # Create message object
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

    # Sort messages by timestamp
    for channel_name in messages["channels"]:
        messages["channels"][channel_name].sort(key=lambda x: x["timestamp"])


# Generate test messages on startup
generate_test_messages()


@app.route('/')
def index():
    return send_from_directory('.', 'chat.html')

# Rotta per servire file statici CSS


@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)


@app.route('/api/users')
def get_users():
    return jsonify(users)


@app.route('/api/channels')
def get_channels():
    return jsonify(channels)


@app.route('/api/messages/channel/<channel_name>')
def get_channel_messages(channel_name):
    return jsonify(messages["channels"].get(channel_name, []))


@app.route('/api/messages/dm/<user_id>')
def get_dm_messages(user_id):
    dm_key = f"dm:{user_id}"
    return jsonify(messages["directMessages"].get(dm_key, []))


@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('initialData', {'users': users, 'channels': channels})


@socketio.on('disconnect')
def handle_disconnect(sid=None):
    print('Client disconnected')


@socketio.on('joinChannel')
def handle_join_channel(channel_name):
    print(f'Client joining channel: {channel_name}')
    room = f"channel:{channel_name}"
    join_room(room)
    # Send channel history
    channel_history = messages["channels"].get(channel_name, [])
    emit('messageHistory', channel_history)


@socketio.on('joinDirectMessage')
def handle_join_dm(user_id):
    dm_key = f"dm:{user_id}"
    join_room(dm_key)

    # If no DM history exists, create some test messages
    if dm_key not in messages["directMessages"]:
        messages["directMessages"][dm_key] = []

        # Generate 5-15 test messages for this DM
        global message_id_counter
        num_messages = random.randint(5, 15)

        for i in range(num_messages):
            message_id_counter += 1

            # Alternate between the user and "You"
            if i % 2 == 0:
                sender = next((u for u in users if str(
                    u["id"]) == str(user_id)), users[0])
                is_own = False
            else:
                sender = users[0]  # "You"
                is_own = True

            text = random.choice(message_texts)

            # Simulate messages over the last 7 days
            days_ago = random.randint(0, 7)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            timestamp = datetime.now() - timedelta(days=days_ago,
                                                   hours=hours_ago, minutes=minutes_ago)

            # Determine message type (normal, file, forwarded)
            message_type = "normal"
            file_data = None
            forwarded_from = None

            rand_val = random.random()
            if rand_val < 0.1:  # 10% chance for file
                message_type = "file"
                file_data = random.choice(file_types)
            elif rand_val < 0.2:  # 10% chance for forwarded
                message_type = "forwarded"
                forward_user_id = random.randint(1, len(users)-1)
                while forward_user_id == user_id:  # Don't forward from the same user
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

        # Sort messages by timestamp
        messages["directMessages"][dm_key].sort(key=lambda x: x["timestamp"])

    # Send DM history
    emit('messageHistory', messages["directMessages"].get(dm_key, []))


@socketio.on('channelMessage')
def handle_channel_message(data):
    channel_name = data.get('channelName')
    message_data = data.get('message')

    print(f"Received channel message: {data}")

    if not channel_name or not message_data:
        return

    global message_id_counter
    message_id_counter += 1

    # Ensure the channel exists
    if channel_name not in messages["channels"]:
        messages["channels"][channel_name] = []

    # Process reply
    reply_to = None
    if 'replyTo' in message_data and message_data['replyTo']:
        reply_id = message_data['replyTo']['id']
        # Find the message being replied to
        for msg in messages["channels"][channel_name]:
            if msg["id"] == reply_id:
                reply_to = msg
                break

    # Create new message with server timestamp
    new_message = {
        "id": message_id_counter,
        "user": users[0],  # "You"
        "text": message_data.get('text', ''),
        "timestamp": datetime.now().isoformat(),
        "isOwn": True,
        "type": message_data.get('type', 'normal'),
        "fileData": message_data.get('fileData'),
        "forwardedFrom": message_data.get('forwardedFrom'),
        "replyTo": reply_to
    }

    # Store the message
    messages["channels"][channel_name].append(new_message)

    # Broadcast to channel
    room = f"channel:{channel_name}"
    emit('newMessage', new_message, room=room)


@socketio.on('directMessage')
def handle_direct_message(data):
    user_id = data.get('userId')
    message_data = data.get('message')

    print(f"Received direct message: {data}")

    if not user_id or not message_data:
        return

    global message_id_counter
    message_id_counter += 1

    dm_key = f"dm:{user_id}"

    # Ensure the DM exists
    if dm_key not in messages["directMessages"]:
        messages["directMessages"][dm_key] = []

    # Process reply
    reply_to = None
    if 'replyTo' in message_data and message_data['replyTo']:
        reply_id = message_data['replyTo']['id']
        # Find the message being replied to
        for msg in messages["directMessages"][dm_key]:
            if msg["id"] == reply_id:
                reply_to = msg
                break

    # Create new message with server timestamp
    new_message = {
        "id": message_id_counter,
        "user": users[0],  # "You"
        "text": message_data.get('text', ''),
        "timestamp": datetime.now().isoformat(),
        "isOwn": True,
        "type": message_data.get('type', 'normal'),
        "fileData": message_data.get('fileData'),
        "forwardedFrom": message_data.get('forwardedFrom'),
        "replyTo": reply_to
    }

    # Store the message
    messages["directMessages"][dm_key].append(new_message)

    # Send to recipient
    emit('newMessage', new_message, room=dm_key)

    # Get response from LLM
    message_id_counter += 1
    recipient = next((u for u in users if str(u["id"]) == str(user_id)), None)

    if recipient:
        # Verifica se la richiesta deve essere limitat
        if rate_limit_llm_request(user_id):
			# Invia messaggio di errore per rate limiting
            rate_limit_message = {
				"id": message_id_counter,
				"user": recipient,
				"text": "Per favore attendi qualche secondo prima di inviare un altro messaggio.",
				"timestamp": datetime.now().isoformat(),
				"isOwn": False,
				"type": "normal",
				"fileData": None,
				"forwardedFrom": None,
				"replyTo": new_message
			}
            messages["directMessages"][dm_key].append(rate_limit_message)
            emit('newMessage', rate_limit_message, room=dm_key)
            return

        try:
            # Emit model inference started event
            emit('modelInference', {'userId': user_id, 'status': 'started'}, room=dm_key)
            
            # Get response from OpenRouter API
            llm_response = get_llm_response(message_data.get('text', ''))
            
            # Calculate a more natural typing delay based on response length
            # Minimum 1 second, maximum 3 seconds
            typing_delay = min(3, max(1, 0.05 * len(llm_response)))
            socketio.sleep(typing_delay)
            
            # Emit model inference completed event
            emit('modelInference', {'userId': user_id, 'status': 'completed'}, room=dm_key)
            
            # Create response message
            response = {
                "id": message_id_counter,
                "user": recipient,
                "text": llm_response,
                "timestamp": datetime.now().isoformat(),
                "isOwn": False,
                "type": "normal",
                "fileData": None,
                "forwardedFrom": None,
                "replyTo": new_message
            }

            # Store and send the message
            messages["directMessages"][dm_key].append(response)
            emit('newMessage', response, room=dm_key)
            
        except Exception as e:
            print(f"Error processing LLM response: {e}")
            
            # Emit error notification
            emit('modelInference', {'userId': user_id, 'status': 'error'}, room=dm_key)
            
            # Send fallback message
            fallback_response = {
                "id": message_id_counter,
                "user": recipient,
                "text": "Mi dispiace, non sono riuscito a generare una risposta. Riprova più tardi.",
                "timestamp": datetime.now().isoformat(),
                "isOwn": False,
                "type": "normal",
                "fileData": None,
                "forwardedFrom": None,
                "replyTo": new_message
            }
            
            messages["directMessages"][dm_key].append(fallback_response)
            emit('newMessage', fallback_response, room=dm_key)

@socketio.on('typing')
def handle_typing(data):
    channel_name = data.get('channelName')
    user_id = data.get('userId')
    is_typing = data.get('isTyping')

    if channel_name:
        room = f"channel:{channel_name}"
        emit('userTyping', {'userId': user_id,
             'isTyping': is_typing}, room=room, include_self=False)
    elif user_id:
        room = f"dm:{user_id}"
        emit('userTyping', {'userId': user_id,
             'isTyping': is_typing}, room=room, include_self=False)


@socketio.on('statusChange')
def handle_status_change(data):
    user_id = data.get('userId')
    status = data.get('status')

    if not user_id or not status:
        return

    # Update user status
    for user in users:
        if user["id"] == user_id:
            user["status"] = status
            emit('userStatusUpdate', {
                 'userId': user_id, 'status': status}, broadcast=True)
            break

# Struttura dati per prevenire cicli infiniti
last_llm_requests = {}

def rate_limit_llm_request(user_id):
    """
    Verifica se una richiesta LLM per lo stesso utente è stata effettuata troppo recentemente.
    Restituisce True se la richiesta dovrebbe essere bloccata, False altrimenti.
    """
    global last_llm_requests
    
    current_time = time.time()
    last_request_time = last_llm_requests.get(user_id, 0)
    
    # Blocca richieste troppo frequenti (meno di 2 secondi tra una richiesta e l'altra)
    if current_time - last_request_time < 2:
        print(f"Rate limiting LLM request for user {user_id}")
        return True
    
    # Aggiorna il timestamp dell'ultima richiesta
    last_llm_requests[user_id] = current_time
    return False

# Modifica la parte finale del file
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    
    # In modalità sviluppo, usa il server integrato di Flask
    if os.getenv('FLASK_ENV') == 'development':
        socketio.run(app, host='0.0.0.0', port=port, debug=True)
    else:
        # In produzione, il server sarà gestito da Gunicorn
        # Questo codice non verrà eseguito quando si usa Gunicorn
        print("Per eseguire in produzione, usa: gunicorn -c gunicorn_config.py app:app")
        socketio.run(app, host='0.0.0.0', port=port, debug=False)
