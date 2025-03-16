from datetime import datetime
from flask_socketio import emit, join_room, leave_room
import time
import json
import tempfile
import subprocess
import os

from chat.models import users, channels, messages, message_id_counter, rate_limit_llm_request
from common.config import OPENROUTER_API_KEY, OPENROUTER_API_URL

def get_llm_response(message_text):
    """
    Ottiene una risposta dal modello LLM tramite l'API OpenRouter.
    """
    if not OPENROUTER_API_KEY:
        return "API key non configurata. Configura OPENROUTER_API_KEY nelle variabili d'ambiente."
    
    try:
        # Prepara il payload per la richiesta
        payload = {
            "model": "openai/gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant in a chat application."},
                {"role": "user", "content": message_text}
            ]
        }
        
        # Salva il payload in un file temporaneo
        with tempfile.NamedTemporaryFile(suffix='.json', mode='w+', delete=False) as f:
            json.dump(payload, f)
            payload_file = f.name
        
        # Comando curl per inviare la richiesta
        cmd = [
            'curl', '-s', '-X', 'POST',
            '-H', f'Authorization: Bearer {OPENROUTER_API_KEY}',
            '-H', 'Content-Type: application/json',
            '-d', f'@{payload_file}',
            OPENROUTER_API_URL
        ]
        
        # Esegui curl in un processo separato
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        # Elimina il file temporaneo
        os.unlink(payload_file)
        
        # Verifica se ci sono errori
        if result.returncode != 0:
            return f"API call failed: {result.stderr}"
        
        # Analizza la risposta JSON
        try:
            response_data = json.loads(result.stdout)
            return response_data['choices'][0]['message']['content']
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            return f"Error parsing API response: {str(e)}"
        
    except subprocess.TimeoutExpired:
        return "API call timed out after 10 seconds"
    except Exception as e:
        return f"Error during API call: {str(e)}"

def register_handlers(socketio):
    """
    Registra tutti gli handler degli eventi Socket.IO.
    """
    
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')
        emit('initialData', {'users': users, 'channels': channels})

    @socketio.on('disconnect')
    def handle_disconnect():
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
            from chat.models import generate_dm_messages
            generate_dm_messages(user_id)

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
            # Verifica se la richiesta deve essere limitata
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