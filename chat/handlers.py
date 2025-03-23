# Update imports
from datetime import datetime
from flask_socketio import emit, join_room, leave_room
import time
import json
import tempfile
import subprocess
import os
import requests

from chat.db_models import User, Conversation, Message
from common.config import OPENROUTER_API_KEY, OPENROUTER_API_URL
from common.db.connection import get_db_cursor
from chat.routes import safe_json, CustomJSONEncoder  # Importa la funzione safe_json

# Dopo gli import

def prepare_for_socketio(data):
    """Prepara i dati per essere inviati tramite Socket.IO"""
    # Serializza e deserializza per garantire che tutti gli oggetti siano JSON-compatibili
    return json.loads(safe_json(data))

def ensure_users_exist():
    """Ensure that basic users exist in the database with proper data"""
    with get_db_cursor(commit=True) as cursor:
        # Check if AI user exists
        cursor.execute("SELECT id FROM chat_schema.users WHERE id = 2")
        if not cursor.fetchone():
            cursor.execute(
                """
                INSERT INTO chat_schema.users (id, username, display_name, avatar_url, status)
                VALUES (2, 'john_doe', 'John Doe', 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff', 'online')
                """
            )
            print("Created AI user")
        else:
            # Update AI user
            cursor.execute(
                """
                UPDATE chat_schema.users 
                SET username = 'john_doe', 
                    display_name = 'John Doe', 
                    avatar_url = 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff', 
                    status = 'online'
                WHERE id = 2
                """
            )
            print("Updated AI user")

        # Check if current user exists
        cursor.execute("SELECT id FROM chat_schema.users WHERE id = 1")
        if not cursor.fetchone():
            cursor.execute(
                """
                INSERT INTO chat_schema.users (id, username, display_name, avatar_url, status)
                VALUES (1, 'owner', 'Owner', 'https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff', 'online')
                """
            )
            print("Created current user")
        else:
            # Update current user
            cursor.execute(
                """
                UPDATE chat_schema.users 
                SET username = 'owner', 
                    display_name = 'Owner', 
                    avatar_url = 'https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff', 
                    status = 'online'
                WHERE id = 1
                """
            )
            print("Updated current user")


def get_llm_response(message_text):
    """Get a response from the LLM API"""
    try:
        # Prepare the API request
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }

        data = {
            # You can change this to any model supported by OpenRouter
            #"model": "openai/gpt-3.5-turbo",
            "model": "google/gemma-3-27b-it:free",
            "messages": [
                {"role": "system",
                    "content": "You are a helpful assistant in a chat application."},
                {"role": "user", "content": message_text}
            ],
            "max_tokens": 500
        }

        # Make the API request
        response = requests.post(
            OPENROUTER_API_URL, headers=headers, json=data)
        response.raise_for_status()

        # Parse the response
        result = response.json()
        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            return "I'm sorry, I couldn't generate a response."

    except Exception as e:
        print(f"Error getting LLM response: {str(e)}")
        return "Sorry, I encountered an error while processing your message."

# Helper functions


def get_users_data():
    """Get all users from database in format needed by frontend"""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM chat_schema.users ORDER BY display_name")
        users = cursor.fetchall()

    # Convert to dictionary format expected by frontend
    user_list = []
    for user in users:
        user_list.append({
            "id": user['id'],
            "username": user['username'],
            "displayName": user['display_name'],
            "avatarUrl": user['avatar_url'],
            "status": user['status']
        })

    return user_list


def get_channels_data():
    """Get all channels from database in format needed by frontend"""
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT c.id, c.name, c.description, c.is_private,
                   COUNT(cm.user_id) as member_count
            FROM chat_schema.channels c
            LEFT JOIN chat_schema.channel_members cm ON c.id = cm.channel_id
            GROUP BY c.id
            ORDER BY c.name
            """
        )
        channels = cursor.fetchall()

    # Convert to dictionary format expected by frontend
    channel_list = []
    for channel in channels:
        channel_list.append({
            "id": channel['id'],
            "name": channel['name'],
            "description": channel['description'],
            "isPrivate": channel['is_private'],
            "memberCount": channel['member_count']
        })

    return channel_list


def register_handlers(socketio):
    """
    Register all Socket.IO event handlers.
    """
    # Ensure users exist before registering handlers
    ensure_users_exist()
    # per assicurarti che le conversazioni dei canali esistano
    ensure_channel_conversations_exist()

    # In handle_connect
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')
        # Send initial data with app configuration
        emit('initialData', prepare_for_socketio({
            'users': get_users_data(),
            'channels': get_channels_data(),
            'currentUser': {
                'id': 1,
                'username': 'owner',
                'displayName': 'Owner',
                'avatarUrl': 'https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff',
                'status': 'online'
            }
        }))

        # Send app configuration
        emit('appConfig', {
            'baseUrl': '/chat',
            'apiUrl': '/api',
            'socketUrl': '',
            'avatarBasePath': 'https://ui-avatars.com/api/?name='
        })

    @socketio.on('disconnect')
    # Modificato per accettare l'argomento reason
    def handle_disconnect(reason=None):
        print(f'Client disconnected: {reason}')

    @socketio.on('joinChannel')
    def handle_join_channel(data):
        """Handle client joining a channel"""
        # Gestisci sia stringhe che dizionari
        if isinstance(data, str):
            channel_name = data
        elif isinstance(data, dict):
            channel_name = data.get('channel')
        else:
            print(f"Error: unexpected data type for joinChannel: {type(data)}: {data}")
            return

        if not channel_name:
            return

        print(f"Client joining channel: {channel_name}")

        # Join the room for this channel
        room = f"channel:{channel_name}"
        join_room(room)

        # Notify other users that someone joined
        emit('userJoined', {
            'channel': channel_name,
            'user': 'You'  # In a real app, this would be the actual user
        }, room=room, include_self=False)

        # Trova la conversazione del canale
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id FROM chat_schema.conversations c
                WHERE c.name = %s AND c.type = 'channel'
                """,
                (channel_name,)
            )
            result = cursor.fetchone()

        if not result:
            emit('messageHistory', [])
            return

        conversation_id = result['id']

        # Get messages
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT m.id, m.conversation_id, m.user_id, m.reply_to_id, 
                    m.text, m.message_type, m.file_data, m.forwarded_from_id,
                    m.metadata, m.edited, m.edited_at, m.created_at,
                    u.username, u.display_name, u.avatar_url, u.status
                FROM chat_schema.messages m
                JOIN chat_schema.users u ON m.user_id = u.id
                WHERE m.conversation_id = %s
                ORDER BY m.created_at DESC
                LIMIT 50
                """,
                (conversation_id,)
            )
            messages = cursor.fetchall()
            
            # Fetch all reply messages in a single query
            reply_ids = [msg['reply_to_id'] for msg in messages if msg['reply_to_id'] is not None]
            reply_messages = {}
            
            if reply_ids:
                # Create placeholders for SQL IN clause
                placeholders = ', '.join(['%s'] * len(reply_ids))
                cursor.execute(
                    f"""
                    SELECT m.id, m.text, m.message_type, m.file_data,
                        u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
                    FROM chat_schema.messages m
                    JOIN chat_schema.users u ON m.user_id = u.id
                    WHERE m.id IN ({placeholders})
                    """,
                    reply_ids
                )
                reply_results = cursor.fetchall()
                
                # Process reply messages
                for reply in reply_results:
                    # Parse file_data for reply
                    reply_file_data = None
                    if reply['file_data']:
                        if isinstance(reply['file_data'], dict):
                            reply_file_data = reply['file_data']
                        else:
                            try:
                                reply_file_data = json.loads(reply['file_data'])
                            except (json.JSONDecodeError, TypeError):
                                print(f"Error parsing file_data for reply message {reply['id']}")
                                reply_file_data = None
                    
                    # Build reply message object
                    reply_messages[reply['id']] = {
                        'id': reply['id'],
                        'text': reply['text'],
                        'message_type': reply['message_type'],
                        'fileData': reply_file_data,
                        'user': {
                            'id': reply['user_id'],
                            'username': reply['username'],
                            'displayName': reply['display_name'],
                            'avatarUrl': reply['avatar_url'],
                            'status': reply['status']
                        }
                    }

        # Convert to dictionary format
        message_list = []
        for msg in messages:
            # CORREZIONE: gestione coerente di file_data
            file_data = None
            if msg['file_data']:
                # Se è già un dict, usalo così com'è, altrimenti prova a deserializzare
                if isinstance(msg['file_data'], dict):
                    file_data = msg['file_data']
                else:
                    try:
                        file_data = json.loads(msg['file_data'])
                    except (json.JSONDecodeError, TypeError):
                        print(f"Error parsing file_data for message {msg['id']}")
                        file_data = None

            # Get reply_to from cached results
            reply_to = None
            if msg['reply_to_id'] and msg['reply_to_id'] in reply_messages:
                reply_to = reply_messages[msg['reply_to_id']]

            message_list.append({
                'id': msg['id'],
                'conversationId': msg['conversation_id'],
                'user': {
                    'id': msg['user_id'],
                    'username': msg['username'],
                    'displayName': msg['display_name'],
                    'avatarUrl': msg['avatar_url'],
                    'status': msg['status']
                },
                'text': msg['text'],
                'timestamp': msg['created_at'].isoformat(),
                'type': msg['message_type'],
                'fileData': file_data,
                'replyTo': reply_to,
                'forwardedFrom': None,
                'metadata': json.loads(msg['metadata']) if msg['metadata'] and not isinstance(msg['metadata'], dict) else msg['metadata'] or {},
                'edited': msg['edited'],
                'editedAt': msg['edited_at'].isoformat() if msg['edited_at'] else None,
                'isOwn': msg['user_id'] == 1  # Assume current user is ID 1
            })

        # Reverse to show oldest messages first
        message_list.reverse()

        try:
            # Prima serializza in JSON, poi deserializza per garantire che sia valido
            serialized_data = json.dumps(message_list, cls=CustomJSONEncoder)
            deserialized_data = json.loads(serialized_data)
            # Send channel history
            emit('messageHistory', deserialized_data)
        except Exception as e:
            print(f"Error preparing message history for Socket.IO: {str(e)}")
            emit('messageHistory', [])  # Invia una lista vuota in caso di errore

    @socketio.on('joinDirectMessage')
    def handle_join_dm(data):
        """Handle client joining a direct message conversation"""
        # Handle both integers and dictionaries
        if isinstance(data, int):
            user_id = data
        elif isinstance(data, dict):
            user_id = data.get('userId')
        else:
            print(f"Error: unexpected data type for joinDirectMessage: {type(data)}: {data}")
            return

        if not user_id:
            return

        print(f"Client joining DM with user: {user_id}")

        # Join the room for this DM
        room = f"dm:{user_id}"
        join_room(room)

        # Find the DM conversation
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id FROM chat_schema.conversations c
                JOIN chat_schema.conversation_participants cp1 ON c.id = cp1.conversation_id
                JOIN chat_schema.conversation_participants cp2 ON c.id = cp2.conversation_id
                WHERE c.type = 'direct'
                AND cp1.user_id = 1  -- Assuming current user has ID 1
                AND cp2.user_id = %s
                """,
                (user_id,)
            )
            result = cursor.fetchone()

        if not result:
            emit('messageHistory', [])
            return

        conversation_id = result['id']

        # Get messages
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT m.id, m.conversation_id, m.user_id, m.reply_to_id, 
                    m.text, m.message_type, m.file_data, m.forwarded_from_id,
                    m.metadata, m.edited, m.edited_at, m.created_at,
                    u.username, u.display_name, u.avatar_url, u.status
                FROM chat_schema.messages m
                JOIN chat_schema.users u ON m.user_id = u.id
                WHERE m.conversation_id = %s
                ORDER BY m.created_at DESC
                LIMIT 50
                """,
                (conversation_id,)
            )
            messages = cursor.fetchall()
            
            # Fetch all reply messages in a single query
            reply_ids = [msg['reply_to_id'] for msg in messages if msg['reply_to_id'] is not None]
            reply_messages = {}
            
            if reply_ids:
                # Create placeholders for SQL IN clause
                placeholders = ', '.join(['%s'] * len(reply_ids))
                cursor.execute(
                    f"""
                    SELECT m.id, m.text, m.message_type, m.file_data,
                        u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
                    FROM chat_schema.messages m
                    JOIN chat_schema.users u ON m.user_id = u.id
                    WHERE m.id IN ({placeholders})
                    """,
                    reply_ids
                )
                reply_results = cursor.fetchall()
                
                # Process reply messages
                for reply in reply_results:
                    # Parse file_data for reply
                    reply_file_data = None
                    if reply['file_data']:
                        if isinstance(reply['file_data'], dict):
                            reply_file_data = reply['file_data']
                        else:
                            try:
                                reply_file_data = json.loads(reply['file_data'])
                            except (json.JSONDecodeError, TypeError):
                                print(f"Error parsing file_data for reply message {reply['id']}")
                                reply_file_data = None
                    
                    # Build reply message object
                    reply_messages[reply['id']] = {
                        'id': reply['id'],
                        'text': reply['text'],
                        'message_type': reply['message_type'],
                        'fileData': reply_file_data,
                        'user': {
                            'id': reply['user_id'],
                            'username': reply['username'],
                            'displayName': reply['display_name'],
                            'avatarUrl': reply['avatar_url'],
                            'status': reply['status']
                        }
                    }

        # Convert to dictionary format
        message_list = []
        for msg in messages:
            # FIXED: Consistent handling of file_data
            file_data = None
            if msg['file_data']:
                # If it's already a dict, use it as is, otherwise try to deserialize
                if isinstance(msg['file_data'], dict):
                    file_data = msg['file_data']
                else:
                    try:
                        file_data = json.loads(msg['file_data'])
                    except (json.JSONDecodeError, TypeError):
                        print(f"Error parsing file_data for message {msg['id']}")
                        file_data = None

            # FIXED: Consistent handling of metadata
            metadata = None
            if msg['metadata']:
                if isinstance(msg['metadata'], dict):
                    metadata = msg['metadata']
                else:
                    try:
                        metadata = json.loads(msg['metadata'])
                    except (json.JSONDecodeError, TypeError):
                        print(f"Error parsing metadata for message {msg['id']}")
                        metadata = {}
            else:
                metadata = {}

            # Get reply_to from cached results
            reply_to = None
            if msg['reply_to_id'] and msg['reply_to_id'] in reply_messages:
                reply_to = reply_messages[msg['reply_to_id']]

            message_list.append({
                'id': msg['id'],
                'conversationId': msg['conversation_id'],
                'user': {
                    'id': msg['user_id'],
                    'username': msg['username'],
                    'displayName': msg['display_name'],
                    'avatarUrl': msg['avatar_url'],
                    'status': msg['status']
                },
                'text': msg['text'],
                'timestamp': msg['created_at'].isoformat(),
                'type': msg['message_type'],
                'fileData': file_data,
                'replyTo': reply_to,  # Now using the full reply object
                'forwardedFrom': None,  # Would need additional query to get forwarded details
                'metadata': metadata,
                'edited': msg['edited'],
                'editedAt': msg['edited_at'].isoformat() if msg['edited_at'] else None,
                'isOwn': msg['user_id'] == 1  # Assume current user is ID 1
            })

        # Reverse to show oldest messages first
        message_list.reverse()

        # Send DM history using prepare_for_socketio to ensure proper serialization
        emit('messageHistory', prepare_for_socketio(message_list))


    @socketio.on('channelMessage')
    def handle_channel_message(data):
        """Handle channel message from client"""
        channel_name = data.get('channelName')
        message_data = data.get('message')

        print(f"Received channel message: {data}")

        if not channel_name or not message_data:
            print("Missing channel name or message data")
            return

        # Find the channel conversation
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id FROM chat_schema.conversations c
                WHERE c.name = %s AND c.type = 'channel'
                """,
                (channel_name,)
            )
            result = cursor.fetchone()

        if not result:
            print(f"Error: No conversation found for channel {channel_name}")
            # Crea la conversazione se non esiste
            with get_db_cursor(commit=True) as cursor:
                cursor.execute(
                    """
                    INSERT INTO chat_schema.conversations (name, type)
                    VALUES (%s, %s)
                    RETURNING id
                    """,
                    (channel_name, 'channel')
                )
                result = cursor.fetchone()
                print(
                    f"Created new conversation for channel {channel_name} with ID {result['id']}")

        conversation_id = result['id']
        print(
            f"Using conversation ID {conversation_id} for channel {channel_name}")

        # Process reply
        reply_to_id = None
        if 'replyTo' in message_data and message_data['replyTo']:
            if isinstance(message_data['replyTo'], dict):
                reply_to_id = message_data['replyTo'].get('id')
            else:
                reply_to_id = message_data['replyTo']

        # Extract forwarded info if present
        forwarded_from_id = None
        if 'forwardedFrom' in message_data and message_data['forwardedFrom']:
            if isinstance(message_data['forwardedFrom'], dict):
                forwarded_from_id = message_data['forwardedFrom'].get('id')
            else:
                forwarded_from_id = message_data['forwardedFrom']

        # Create new message with better error handling
        try:
            with get_db_cursor(commit=True) as cursor:
                cursor.execute(
                    """
                    INSERT INTO chat_schema.messages 
                    (conversation_id, user_id, reply_to_id, text, message_type, file_data, forwarded_from_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                    """,
                    (
                        conversation_id,
                        1,  # current user id
                        reply_to_id,
                        message_data.get('text'),
                        message_data.get('type', 'normal'),
                        json.dumps(message_data.get('fileData')) if message_data.get(
                            'fileData') else None,
                        forwarded_from_id
                    )
                )
                result = cursor.fetchone()
                message_id = result['id']
                created_at = result['created_at']

                print(
                    f"Successfully inserted message with ID {message_id} for channel {channel_name}")

                # Get user details
                cursor.execute(
                    """
                    SELECT id, username, display_name, avatar_url, status 
                    FROM chat_schema.users WHERE id = 1
                    """
                )
                current_user = cursor.fetchone()
        except Exception as e:
            print(f"Error saving channel message: {str(e)}")
            return

        # Prepare message for sending
        message_dict = {
            'id': message_id,
            'conversationId': conversation_id,
            'user': {
                'id': current_user['id'],
                'username': current_user['username'],
                'displayName': current_user['display_name'],
                'avatarUrl': current_user['avatar_url'],
                'status': current_user['status']
            },
            'text': message_data.get('text'),
            'timestamp': created_at.isoformat(),
            'type': message_data.get('type', 'normal'),
            'fileData': message_data.get('fileData'),
            'replyTo': None,  # Would need to fetch reply details
            'forwardedFrom': None,  # Would need to fetch forwarded details
            'metadata': message_data.get('metadata'),
            'edited': False,
            'editedAt': None,
            'isOwn': True,  # Mark as own message for sender
            'tempId': message_data.get('tempId')
        }

        # Broadcast to channel
        room = f"channel:{channel_name}"
        emit('newMessage', prepare_for_socketio(message_dict), room=room)
        print(f"Broadcasted message {message_id} to room {room}")

    @socketio.on('directMessage')
    def handle_direct_message(data):
        """Handle direct message from client"""
        print(f"Received direct message: {data}")
        user_id = data.get('userId')
        message_data = data.get('message', {})

        if not user_id or not message_data.get('text'):
            return

        # Define room at the beginning of the function
        room = f"dm:{user_id}"

        # Check if users exist
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT id, username, display_name, avatar_url, status FROM chat_schema.users WHERE id = %s", (user_id,))
            target_user = cursor.fetchone()

            cursor.execute(
                "SELECT id, username, display_name, avatar_url, status FROM chat_schema.users WHERE id = 1")
            current_user = cursor.fetchone()

        # Verify users exist and have valid data
        if not target_user or not current_user:
            print(f"Error: User not found. Target user ID: {user_id}")
            return

        # Log user data for debugging
        print(f"Target user: {target_user}")
        print(f"Current user: {current_user}")

        # Find the DM conversation between current user and specified user
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id FROM chat_schema.conversations c
                JOIN chat_schema.conversation_participants cp1 ON c.id = cp1.conversation_id
                JOIN chat_schema.conversation_participants cp2 ON c.id = cp2.conversation_id
                WHERE c.type = 'direct'
                AND cp1.user_id = 1  -- Current user
                AND cp2.user_id = %s
                """,
                (user_id,)
            )
            result = cursor.fetchone()

        if not result:
            # Create a new conversation if it doesn't exist
            with get_db_cursor(commit=True) as cursor:
                cursor.execute(
                    """
                    INSERT INTO chat_schema.conversations (name, type)
                    VALUES (%s, %s)
                    RETURNING id
                    """,
                    (f"DM with user {user_id}", "direct")
                )
                conversation_id = cursor.fetchone()['id']

                # Add participants
                cursor.execute(
                    """
                    INSERT INTO chat_schema.conversation_participants (conversation_id, user_id)
                    VALUES (%s, %s), (%s, %s)
                    """,
                    (conversation_id, 1, conversation_id, user_id)
                )
        else:
            conversation_id = result['id']

        # Process file data if present
        file_data_str = None
        if message_data.get('fileData'):
            try:
                if isinstance(message_data['fileData'], dict):
                    file_data_str = json.dumps(message_data['fileData'])
                else:
                    # Ensure it's valid JSON before storing
                    file_data = json.loads(json.dumps(message_data['fileData']))
                    file_data_str = json.dumps(file_data)
            except (TypeError, json.JSONDecodeError) as e:
                print(f"Error processing file data: {e}")
                file_data_str = None

        # Create user message
        with get_db_cursor(commit=True) as cursor:
            cursor.execute(
                """
                INSERT INTO chat_schema.messages 
                (conversation_id, user_id, reply_to_id, text, message_type, file_data, forwarded_from_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (
                    conversation_id,
                    1,  # current user id
                    message_data.get('replyTo', {}).get('id') if isinstance(message_data.get('replyTo'), dict) else message_data.get('replyTo'),
                    message_data.get('text', ''),
                    message_data.get('type', 'normal'),
                    file_data_str,
                    message_data.get('forwardedFrom', {}).get('id') if isinstance(message_data.get('forwardedFrom'), dict) else message_data.get('forwardedFrom')
                )
            )
            result = cursor.fetchone()
            message_id = result['id']
            created_at = result['created_at']

        # Prepare the message with all necessary fields
        message_dict = {
            'id': message_id,
            'conversationId': conversation_id,
            'user': {
                'id': current_user['id'],
                'username': current_user['username'],
                'displayName': current_user['display_name'],
                'avatarUrl': current_user['avatar_url'],
                'status': current_user['status']
            },
            'text': message_data.get('text', ''),
            'timestamp': created_at.isoformat(),
            'type': message_data.get('type', 'normal'),
            'fileData': message_data.get('fileData'),
            'replyTo': None,  # Would need to fetch reply details
            'forwardedFrom': None,  # Would need to fetch forwarded details
            'metadata': message_data.get('metadata', {}),
            'edited': False,
            'editedAt': None,
            'isOwn': True,
            'tempId': message_data.get('tempId')
        }

        # Log the message for debugging
        print(f"Sending message: {message_dict}")

        # Send message to everyone in the room (including sender)
        emit('newMessage', prepare_for_socketio(message_dict), room=room)

        # If message is for AI Assistant (user_id=2), generate a response
        if int(user_id) == 2:
            # Show typing indicator
            emit('typingIndicator', {
                'userId': 2,
                'conversationId': conversation_id,
                'isTyping': True
            }, room=room)

            try:
                # Get AI response
                ai_response = get_llm_response(message_data.get('text', ''))

                # Simulate typing delay
                time.sleep(1.5)

                # Get AI user data from database
                with get_db_cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, username, display_name, avatar_url, status 
                        FROM chat_schema.users WHERE id = 2
                        """
                    )
                    ai_user = cursor.fetchone()
                    print(f"AI user data from database: {ai_user}")

                # Create response message - MODIFICATO PER INCLUDERE reply_to_id
                with get_db_cursor(commit=True) as cursor:
                    cursor.execute(
                        """
                        INSERT INTO chat_schema.messages 
                        (conversation_id, user_id, text, message_type, reply_to_id)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, created_at
                        """,
                        (conversation_id, 2, ai_response, 'normal', message_id)  # Aggiungiamo message_id come reply_to_id
                    )
                    result = cursor.fetchone()
                    ai_message_id = result['id']
                    ai_created_at = result['created_at']

                # Recuperiamo i dettagli del messaggio a cui stiamo rispondendo
                with get_db_cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT m.id, m.text, m.message_type, m.file_data,
                            u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
                        FROM chat_schema.messages m
                        JOIN chat_schema.users u ON m.user_id = u.id
                        WHERE m.id = %s
                        """,
                        (message_id,)
                    )
                    reply_message = cursor.fetchone()
                    
                # Prepara l'oggetto replyTo
                reply_to = None
                if reply_message:
                    # Parse file_data per il messaggio citato
                    reply_file_data = None
                    if reply_message['file_data']:
                        if isinstance(reply_message['file_data'], dict):
                            reply_file_data = reply_message['file_data']
                        else:
                            try:
                                reply_file_data = json.loads(reply_message['file_data'])
                            except (json.JSONDecodeError, TypeError):
                                print(f"Error parsing file_data for reply message {reply_message['id']}")
                                reply_file_data = None
                    
                    # Costruisci l'oggetto reply
                    reply_to = {
                        'id': reply_message['id'],
                        'text': reply_message['text'],
                        'message_type': reply_message['message_type'],
                        'fileData': reply_file_data,
                        'user': {
                            'id': reply_message['user_id'],
                            'username': reply_message['username'],
                            'displayName': reply_message['display_name'],
                            'avatarUrl': reply_message['avatar_url'],
                            'status': reply_message['status']
                        }
                    }

                # Send AI response with user data from database
                ai_message = {
                    'id': ai_message_id,
                    'conversationId': conversation_id,
                    'user': {
                        'id': ai_user['id'],
                        'username': ai_user.get('username', 'AI Assistant'),
                        'displayName': ai_user.get('display_name', 'AI Assistant'),
                        'avatarUrl': ai_user.get('avatar_url', 'https://ui-avatars.com/api/?name=AI+Assistant'),
                        'status': ai_user.get('status', 'online')
                    },
                    'text': ai_response,
                    'timestamp': ai_created_at.isoformat(),
                    'type': 'normal',
                    'fileData': None,
                    'replyTo': reply_to,  # Includiamo l'oggetto reply completo
                    'forwardedFrom': None,
                    'metadata': {},
                    'edited': False,
                    'editedAt': None,
                    'isOwn': False
                }

                print(f"Sending AI response with user data: {ai_message['user']}")
                emit('newMessage', prepare_for_socketio(ai_message), room=room)
            finally:
                # Hide typing indicator
                emit('typingIndicator', {
                    'userId': 2,
                    'conversationId': conversation_id,
                    'isTyping': False
                }, room=room)

    @socketio.on('deleteMessage')
    def handle_delete_message(data):
        """Handle message deletion request from client"""
        message_id = data.get('messageId')
        channel_name = data.get('channelName')
        user_id = data.get('userId')
        
        if not message_id:
            print("Error: Missing message ID for deletion")
            return
        
        print(f"Received delete request for message ID: {message_id}")
        
        try:
            # Prima verifica che il messaggio appartenga all'utente (sicurezza)
            with get_db_cursor() as cursor:
                cursor.execute(
                    """
                    SELECT m.id, m.conversation_id, c.type, c.name 
                    FROM chat_schema.messages m
                    JOIN chat_schema.conversations c ON m.conversation_id = c.id
                    WHERE m.id = %s AND m.user_id = 1  -- Solo messaggi dell'utente corrente
                    """,
                    (message_id,)
                )
                message_info = cursor.fetchone()
            
            if not message_info:
                print(f"Error: Message {message_id} not found or not owned by current user")
                return
            
            # Elimina il messaggio dal database
            with get_db_cursor(commit=True) as cursor:
                cursor.execute(
                    """
                    DELETE FROM chat_schema.messages
                    WHERE id = %s AND user_id = 1  -- Ulteriore controllo di sicurezza
                    """,
                    (message_id,)
                )
                row_count = cursor.rowcount
            
            if row_count > 0:
                # Messaggio eliminato con successo
                print(f"Successfully deleted message {message_id} from database")
                
                # Determina la stanza per l'emissione dell'evento
                if message_info['type'] == 'channel':
                    room = f"channel:{message_info['name']}"
                else:  # Direct message
                    # Trova l'altro partecipante alla conversazione
                    with get_db_cursor() as cursor:
                        cursor.execute(
                            """
                            SELECT user_id FROM chat_schema.conversation_participants
                            WHERE conversation_id = %s AND user_id != 1
                            """,
                            (message_info['conversation_id'],)
                        )
                        participant = cursor.fetchone()
                    
                    if participant:
                        room = f"dm:{participant['user_id']}"
                    else:
                        # Fallback alla conversazione
                        room = f"conversation:{message_info['conversation_id']}"
                
                # Invia evento di eliminazione a tutti nella stanza
                emit('messageDeleted', {
                    'messageId': message_id,
                    'conversationId': message_info['conversation_id']
                }, room=room)
            else:
                print(f"Error: Failed to delete message {message_id}")
        
        except Exception as e:
            print(f"Error during message deletion: {str(e)}")          

    @socketio.on('editMessage')
    def handle_edit_message(data):
        """Handle message edit request from client"""
        message_id = data.get('messageId')
        new_text = data.get('newText')
        channel_name = data.get('channelName')
        user_id = data.get('userId')
        
        if not message_id or not new_text:
            print("Error: Missing message ID or new text for edit")
            return
        
        print(f"Received edit request for message ID: {message_id}")
        
        try:
            # Prima verifica che il messaggio appartenga all'utente (sicurezza)
            with get_db_cursor() as cursor:
                cursor.execute(
                    """
                    SELECT m.id, m.conversation_id, c.type, c.name 
                    FROM chat_schema.messages m
                    JOIN chat_schema.conversations c ON m.conversation_id = c.id
                    WHERE m.id = %s AND m.user_id = 1  -- Solo messaggi dell'utente corrente
                    """,
                    (message_id,)
                )
                message_info = cursor.fetchone()
            
            if not message_info:
                print(f"Error: Message {message_id} not found or not owned by current user")
                return
            
            # Aggiorna il messaggio nel database
            with get_db_cursor(commit=True) as cursor:
                cursor.execute(
                    """
                    UPDATE chat_schema.messages
                    SET text = %s, edited = TRUE, edited_at = NOW()
                    WHERE id = %s AND user_id = 1  -- Ulteriore controllo di sicurezza
                    RETURNING edited_at
                    """,
                    (new_text, message_id)
                )
                result = cursor.fetchone()
                
                if not result:
                    print(f"Error: Failed to update message {message_id}")
                    return
                    
                edited_at = result['edited_at']
            
            # Determina la stanza per l'emissione dell'evento
            if message_info['type'] == 'channel':
                room = f"channel:{message_info['name']}"
            else:  # Direct message
                # Trova l'altro partecipante alla conversazione
                with get_db_cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT user_id FROM chat_schema.conversation_participants
                        WHERE conversation_id = %s AND user_id != 1
                        """,
                        (message_info['conversation_id'],)
                    )
                    participant = cursor.fetchone()
                
                if participant:
                    room = f"dm:{participant['user_id']}"
                else:
                    # Fallback alla conversazione
                    room = f"conversation:{message_info['conversation_id']}"
            
            # Invia evento di modifica a tutti nella stanza
            emit('messageEdited', {
                'messageId': message_id,
                'conversationId': message_info['conversation_id'],
                'newText': new_text,
                'editedAt': edited_at.isoformat()
            }, room=room)
            
            print(f"Successfully updated message {message_id} and broadcasted to {room}")
        
        except Exception as e:
            print(f"Error during message edit: {str(e)}")              

def ensure_channel_conversations_exist():
    """Ensure that all channels have corresponding conversations in the database"""
    with get_db_cursor(commit=True) as cursor:
        # Ottieni tutti i canali
        cursor.execute("SELECT id, name FROM chat_schema.channels")
        channels = cursor.fetchall()

        for channel in channels:
            # Verifica se esiste già una conversazione per questo canale
            cursor.execute(
                """
                SELECT id FROM chat_schema.conversations 
                WHERE name = %s AND type = 'channel'
                """,
                (channel['name'],)
            )
            result = cursor.fetchone()

            if not result:
                # Crea la conversazione se non esiste
                cursor.execute(
                    """
                    INSERT INTO chat_schema.conversations (name, type)
                    VALUES (%s, %s)
                    RETURNING id
                    """,
                    (channel['name'], 'channel')
                )
                conversation_id = cursor.fetchone()['id']
                print(
                    f"Created missing conversation for channel {channel['name']} with ID {conversation_id}")

                # Aggiungi almeno un messaggio di sistema per inizializzare la conversazione
                cursor.execute(
                    """
                    INSERT INTO chat_schema.messages 
                    (conversation_id, user_id, text, message_type)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (
                        conversation_id,
                        2,  # ID utente di sistema (John Doe)
                        f"Welcome to the #{channel['name']} channel!",
                        'system'
                    )
                )

                print(f"Added welcome message to channel {channel['name']}")

