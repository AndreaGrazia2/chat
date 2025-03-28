# Update imports
from datetime import datetime
from flask_socketio import emit, join_room, leave_room
import time
import json
import tempfile
import subprocess
import os
import requests

from chat.models import User, Conversation, Message, ConversationParticipant, Channel, ChannelMember, MessageReadStatus
from chat.database import SessionLocal
from common.config import OPENROUTER_API_KEY, OPENROUTER_API_URL
from chat.routes import safe_json, CustomJSONEncoder 
from agent.chat_agents_middleware import process_message_through_agents, should_generate_assistant_response, get_assistant_response

from contextlib import contextmanager
from common.db.connection import get_db_session

@contextmanager
def get_db():
    """Context manager per ottenere una sessione del database"""
    with get_db_session(SessionLocal) as db:
        yield db

def check_calendar_intent(message_text, user_id, conversation_id, room, original_message_id=None):
    """
    Verifica se il messaggio contiene un intento calendario e invia la risposta appropriata
    
    Args:
        message_text: Testo del messaggio
        user_id: ID dell'utente destinatario (per messaggi diretti)
        conversation_id: ID della conversazione
        room: Room Socket.IO per emettere eventi
        original_message_id: ID del messaggio a cui rispondere
        
    Returns:
        bool: True se è un intento calendario, False altrimenti
    """
    # NUOVO: Emetti evento modelInference 'started' all'inizio dell'elaborazione
    emit('modelInference', {'status': 'started', 'userId': user_id or 2}, room=room)
    
    # Processa il messaggio attraverso gli agenti
    agent_result = process_message_through_agents(message_text)
    
    # Verifica se è un intento calendario
    if should_generate_assistant_response(agent_result):
        # Ottieni la risposta dell'agente
        response = get_assistant_response(agent_result)
        
        if response:
            with get_db() as db:
                # Ottieni dati utente AI dal database (useremo John Doe come mittente)
                ai_user = db.query(User).filter(User.id == 2).first()
                
                # Crea messaggio di risposta con reply_to_id
                ai_message = Message(
                    conversation_id=conversation_id,
                    user_id=2,  # John Doe
                    text=response,
                    message_type='normal',
                    reply_to_id=original_message_id  # Imposta il riferimento al messaggio originale
                )
                db.add(ai_message)
                db.commit()
                db.refresh(ai_message)
                
                ai_message_id = ai_message.id
                ai_created_at = ai_message.created_at
                
                # Se abbiamo un messaggio originale, recuperiamo i suoi dettagli per il reply
                reply_to = None
                if original_message_id:
                    original_message = db.query(Message).get(original_message_id)
                    if original_message:
                        original_user = db.query(User).get(original_message.user_id)
                        if original_user:
                            reply_to = {
                                'id': original_message.id,
                                'text': original_message.text,
                                'message_type': original_message.message_type,
                                'fileData': original_message.file_data,
                                'user': {
                                    'id': original_user.id,
                                    'username': original_user.username,
                                    'displayName': original_user.display_name,
                                    'avatarUrl': original_user.avatar_url,
                                    'status': original_user.status
                                }
                            }
                
                # Invia la risposta dell'agente
                ai_message_dict = {
                    'id': ai_message_id,
                    'conversationId': conversation_id,
                    'user': {
                        'id': ai_user.id,
                        'username': ai_user.username,
                        'displayName': ai_user.display_name,
                        'avatarUrl': ai_user.avatar_url,
                        'status': ai_user.status
                    },
                    'text': response,
                    'timestamp': ai_created_at.isoformat(),
                    'type': 'normal',
                    'fileData': None,
                    'replyTo': reply_to,  # Aggiungi il riferimento al messaggio originale
                    'forwardedFrom': None,
                    'message_metadata': {'calendar_intent': True},  # Aggiungiamo un flag per tracciare
                    'edited': False,
                    'editedAt': None,
                    'isOwn': False
                }
                
                emit('newMessage', prepare_for_socketio(ai_message_dict), room=room)
                
                # Emetti un evento Socket.IO per notificare il frontend del calendario
                if agent_result.get('action') in ['create', 'update', 'delete', 'view']:
                    calendar_event = {
                        'type': 'calendar_update',
                        'action': agent_result.get('action'),
                        'data': agent_result.get('result', {})
                    }
                    
                    # Log dettagliato dell'evento prima dell'emissione
                    logger.info(f"Emitting calendarEvent: {calendar_event}")
                    print(f"[CALENDAR_DEBUG] Broadcasting calendarEvent: {calendar_event}")

                    # Broadcast a tutti i client - assicura che anche il calendario sia aggiornato
                    emit('calendarEvent', calendar_event, broadcast=True)
            
            # NUOVO: Emetti evento modelInference 'completed' prima di restituire True
            emit('modelInference', {'status': 'completed', 'userId': user_id or 2}, room=room)
            return True
    
    # NUOVO: Emetti evento modelInference 'completed' anche se non è un intento calendario
    emit('modelInference', {'status': 'completed', 'userId': user_id or 2}, room=room)
    return False

def prepare_for_socketio(data):
    """Prepara i dati per essere inviati tramite Socket.IO"""
    # Serializza e deserializza per garantire che tutti gli oggetti siano JSON-compatibili
    return json.loads(safe_json(data))

def ensure_users_exist():
    """Ensure that basic users exist in the database with proper data"""
    with get_db() as db:
        # Check if AI user exists
        ai_user = db.query(User).filter(User.id == 2).first()
        if not ai_user:
            ai_user = User(
                id=2,
                username='john_doe',
                display_name='John Doe',
                avatar_url='https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff',
                status='online'
            )
            db.add(ai_user)
            db.commit()
            print("Created AI user")
        else:
            # Update AI user
            ai_user.username = 'john_doe'
            ai_user.display_name = 'John Doe'
            ai_user.avatar_url = 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff'
            ai_user.status = 'online'
            db.commit()
            print("Updated AI user")

        # Check if current user exists
        current_user = db.query(User).filter(User.id == 1).first()
        if not current_user:
            current_user = User(
                id=1,
                username='owner',
                display_name='Owner',
                avatar_url='https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff',
                status='online'
            )
            db.add(current_user)
            db.commit()
            print("Created current user")
        else:
            # Update current user
            current_user.username = 'owner'
            current_user.display_name = 'Owner'
            current_user.avatar_url = 'https://ui-avatars.com/api/?name=Owner&background=27AE60&color=fff'
            current_user.status = 'online'
            db.commit()
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
    with get_db() as db:
        users = db.query(User).order_by(User.display_name).all()
        
        # Convert to dictionary format expected by frontend
        user_list = []
        for user in users:
            user_list.append({
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "avatarUrl": user.avatar_url,
                "status": user.status
            })
        
        return user_list

def get_channels_data():
    """Get all channels from database in format needed by frontend"""
    with get_db() as db:
        try:
            # SQLAlchemy query with join and group by
            from sqlalchemy import func
            
            channels_with_counts = (
                db.query(Channel, func.count(ChannelMember.user_id).label('member_count'))
                .outerjoin(ChannelMember, Channel.id == ChannelMember.channel_id)
                .group_by(Channel.id)
                .order_by(Channel.name)
                .all()
            )
            
            # Convert to dictionary format expected by frontend
            channel_list = []
            for channel, member_count in channels_with_counts:
                channel_list.append({
                    "id": channel.id,
                    "name": channel.name,
                    "description": channel.description,
                    "isPrivate": channel.is_private,
                    "memberCount": member_count
                })
            
            return channel_list
        except Exception as e:
            print(f"Error getting channels: {str(e)}")
            return []


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

        # Find the channel conversation
        with get_db() as db:
            conversation = (
                db.query(Conversation)
                .filter(Conversation.name == channel_name, Conversation.type == 'channel')
                .first()
            )

            if not conversation:
                emit('messageHistory', [])
                return

            conversation_id = conversation.id

            # Get messages
            messages = (
                db.query(Message, User)
                .join(User, Message.user_id == User.id)
                .filter(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.desc())
                .limit(50)
                .all()
            )
            
            # Collect reply_to_ids
            reply_ids = [msg.reply_to_id for msg, _ in messages if msg.reply_to_id is not None]
            reply_messages = {}
            
            if reply_ids:
                # Fetch reply messages
                reply_msg_users = (
                    db.query(Message, User)
                    .join(User, Message.user_id == User.id)
                    .filter(Message.id.in_(reply_ids))
                    .all()
                )
                
                # Process reply messages
                for reply, user in reply_msg_users:
                    # Parse file_data for reply
                    reply_file_data = None
                    if reply.file_data:
                        reply_file_data = reply.file_data
                    
                    # Build reply message object
                    reply_messages[reply.id] = {
                        'id': reply.id,
                        'text': reply.text,
                        'message_type': reply.message_type,
                        'fileData': reply_file_data,
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'displayName': user.display_name,
                            'avatarUrl': user.avatar_url,
                            'status': user.status
                        }
                    }

            # Convert to dictionary format
            message_list = []
            for msg, user in messages:
                # Handle file_data
                file_data = msg.file_data
                
                # Get reply_to from cached results
                reply_to = None
                if msg.reply_to_id and msg.reply_to_id in reply_messages:
                    reply_to = reply_messages[msg.reply_to_id]

                message_list.append({
                    'id': msg.id,
                    'conversationId': msg.conversation_id,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'displayName': user.display_name,
                        'avatarUrl': user.avatar_url,
                        'status': user.status
                    },
                    'text': msg.text,
                    'timestamp': msg.created_at.isoformat(),
                    'type': msg.message_type,
                    'fileData': file_data,
                    'replyTo': reply_to,
                    'forwardedFrom': None,
                    'message_metadata': msg.message_metadata or {},
                    'edited': msg.edited,
                    'editedAt': msg.edited_at.isoformat() if msg.edited_at else None,
                    'isOwn': msg.user_id == 1  # Assume current user is ID 1
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
        with get_db() as db:
            # Query utilizzando SQLAlchemy
            conversation = (
                db.query(Conversation)
                .join(ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id)
                .filter(
                    Conversation.type == 'direct',
                    ConversationParticipant.user_id == 1  # Current user
                )
                .filter(
                    # Trova la conversazione con l'altro utente
                    Conversation.id.in_(
                        db.query(ConversationParticipant.conversation_id)
                        .filter(ConversationParticipant.user_id == user_id)
                    )
                )
                .first()
            )

            if not conversation:
                emit('messageHistory', [])
                return

            conversation_id = conversation.id

            # Get messages
            messages = (
                db.query(Message, User)
                .join(User, Message.user_id == User.id)
                .filter(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.desc())
                .limit(50)
                .all()
            )
            
            # Collect reply_to_ids
            reply_ids = [msg.reply_to_id for msg, _ in messages if msg.reply_to_id is not None]
            reply_messages = {}
            
            if reply_ids:
                # Fetch reply messages
                reply_msg_users = (
                    db.query(Message, User)
                    .join(User, Message.user_id == User.id)
                    .filter(Message.id.in_(reply_ids))
                    .all()
                )
                
                # Process reply messages
                for reply, user in reply_msg_users:
                    # Parse file_data for reply
                    reply_file_data = reply.file_data
                    
                    # Build reply message object
                    reply_messages[reply.id] = {
                        'id': reply.id,
                        'text': reply.text,
                        'message_type': reply.message_type,
                        'fileData': reply_file_data,
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'displayName': user.display_name,
                            'avatarUrl': user.avatar_url,
                            'status': user.status
                        }
                    }

            # Convert to dictionary format
            message_list = []
            for msg, user in messages:
                # Get forwarded user data (if present)
                forwarded_from = None
                if msg.forwarded_from_id:
                    forwarded_user = db.query(User).get(msg.forwarded_from_id)
                    if forwarded_user:
                        forwarded_from = {
                            'id': msg.forwarded_from_id,
                            'user': {
                                'id': forwarded_user.id,
                                'username': forwarded_user.username,
                                'displayName': forwarded_user.display_name,
                                'avatarUrl': forwarded_user.avatar_url,
                                'status': forwarded_user.status
                            }
                        }
                
                # Get reply_to from cached results
                reply_to = None
                if msg.reply_to_id and msg.reply_to_id in reply_messages:
                    reply_to = reply_messages[msg.reply_to_id]

                message_list.append({
                    'id': msg.id,
                    'conversationId': msg.conversation_id,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'displayName': user.display_name,
                        'avatarUrl': user.avatar_url,
                        'status': user.status
                    },
                    'text': msg.text,
                    'timestamp': msg.created_at.isoformat(),
                    'type': msg.message_type,
                    'fileData': msg.file_data,
                    'replyTo': reply_to,
                    'forwardedFrom': forwarded_from,
                    'message_metadata': msg.message_metadata or {},
                    'edited': msg.edited,
                    'editedAt': msg.edited_at.isoformat() if msg.edited_at else None,
                    'isOwn': msg.user_id == 1  # Assume current user is ID 1
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
        with get_db() as db:
            conversation = (
                db.query(Conversation)
                .filter(Conversation.name == channel_name, Conversation.type == 'channel')
                .first()
            )

            if not conversation:
                print(f"Error: No conversation found for channel {channel_name}")
                # Crea la conversazione se non esiste
                conversation = Conversation(
                    name=channel_name, 
                    type='channel'
                )
                db.add(conversation)
                db.commit()
                db.refresh(conversation)
                print(f"Created new conversation for channel {channel_name} with ID {conversation.id}")

            conversation_id = conversation.id
            print(f"Using conversation ID {conversation_id} for channel {channel_name}")

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
                # Convert file_data to JSON if it's not already
                file_data = message_data.get('fileData')
                
                new_message = Message(
                    conversation_id=conversation_id,
                    user_id=1,  # current user id
                    reply_to_id=reply_to_id,
                    text=message_data.get('text'),
                    message_type=message_data.get('type', 'normal'),
                    file_data=file_data,
                    forwarded_from_id=forwarded_from_id
                )
                db.add(new_message)
                db.commit()
                db.refresh(new_message)
                
                message_id = new_message.id
                created_at = new_message.created_at

                print(f"Successfully inserted message with ID {message_id} for channel {channel_name}")

                # Get user details
                current_user = db.query(User).filter(User.id == 1).first()
            except Exception as e:
                db.rollback()
                print(f"Error saving channel message: {str(e)}")
                return

            # Prepare message for sending
            message_dict = {
                'id': message_id,
                'conversationId': conversation_id,
                'user': {
                    'id': current_user.id,
                    'username': current_user.username,
                    'displayName': current_user.display_name,
                    'avatarUrl': current_user.avatar_url,
                    'status': current_user.status
                },
                'text': message_data.get('text'),
                'timestamp': created_at.isoformat(),
                'type': message_data.get('type', 'normal'),
                'fileData': file_data,
                'replyTo': None,  # Would need to fetch reply details
                'forwardedFrom': None,  # Would need to fetch forwarded details
                'message_metadata': message_data.get('message_metadata'),
                'edited': False,
                'editedAt': None,
                'isOwn': True,  # Mark as own message for sender
                'tempId': message_data.get('tempId')
            }

            # Broadcast to channel
            room = f"channel:{channel_name}"
            emit('newMessage', prepare_for_socketio(message_dict), room=room)
            print(f"Broadcasted message {message_id} to room {room}")
            
            # NUOVA IMPLEMENTAZIONE: Verifica intento calendario per messaggi di canale
            message_text = message_data.get('text', '')
            check_calendar_intent(message_text, None, conversation_id, room, message_id)

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

        with get_db() as db:
            # Check if users exist
            target_user = db.query(User).filter(User.id == user_id).first()
            current_user = db.query(User).filter(User.id == 1).first()

            # Verify users exist and have valid data
            if not target_user or not current_user:
                print(f"Error: User not found. Target user ID: {user_id}")
                return

            # Log user data for debugging
            print(f"Target user: {target_user.username}")
            print(f"Current user: {current_user.username}")

            # Find the DM conversation between current user and specified user
            conversation = (
                db.query(Conversation)
                .join(ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id)
                .filter(
                    Conversation.type == 'direct',
                    ConversationParticipant.user_id == 1  # Current user
                )
                .filter(
                    # Trova la conversazione con l'altro utente
                    Conversation.id.in_(
                        db.query(ConversationParticipant.conversation_id)
                        .filter(ConversationParticipant.user_id == user_id)
                    )
                )
                .first()
            )

            if not conversation:
                # Create a new conversation if it doesn't exist
                conversation = Conversation(
                    name=f"DM with user {user_id}",
                    type="direct"
                )
                db.add(conversation)
                db.commit()
                db.refresh(conversation)
                
                # Add participants
                participants = [
                    ConversationParticipant(conversation_id=conversation.id, user_id=1),
                    ConversationParticipant(conversation_id=conversation.id, user_id=user_id)
                ]
                db.add_all(participants)
                db.commit()
                
            conversation_id = conversation.id

            # Process reply_to, if present
            reply_to_id = None
            if message_data.get('replyTo'):
                if isinstance(message_data['replyTo'], dict):
                    reply_to_id = message_data['replyTo'].get('id')
                else:
                    reply_to_id = message_data['replyTo']
                    
            # Process forwarded_from, if present
            forwarded_from_id = None
            if message_data.get('forwardedFrom'):
                if isinstance(message_data['forwardedFrom'], dict):
                    forwarded_from_id = message_data['forwardedFrom'].get('id')
                else:
                    forwarded_from_id = message_data['forwardedFrom']

            # Create user message
            new_message = Message(
                conversation_id=conversation_id,
                user_id=1,  # current user id
                reply_to_id=reply_to_id,
                text=message_data.get('text', ''),
                message_type=message_data.get('type', 'normal'),
                file_data=message_data.get('fileData'),
                forwarded_from_id=forwarded_from_id,
                message_metadata=message_data.get('message_metadata', {})
            )
            db.add(new_message)
            db.commit()
            db.refresh(new_message)
            
            message_id = new_message.id
            created_at = new_message.created_at

            # Prepare the message with all necessary fields
            message_dict = {
                'id': message_id,
                'conversationId': conversation_id,
                'user': {
                    'id': current_user.id,
                    'username': current_user.username,
                    'displayName': current_user.display_name,
                    'avatarUrl': current_user.avatar_url,
                    'status': current_user.status
                },
                'text': message_data.get('text', ''),
                'timestamp': created_at.isoformat(),
                'type': message_data.get('type', 'normal'),
                'fileData': message_data.get('fileData'),
                'replyTo': None,  # Would need to fetch reply details
                'forwardedFrom': None,  # Would need to fetch forwarded details
                'message_metadata': message_data.get('message_metadata', {}),
                'edited': False,
                'editedAt': None,
                'isOwn': True,
                'tempId': message_data.get('tempId')
            }

            # Log the message for debugging
            print(f"Sending message: {message_dict}")

            # Send message to everyone in the room (including sender)
            emit('newMessage', prepare_for_socketio(message_dict), room=room)
            
            # NUOVA IMPLEMENTAZIONE: Verifica intento calendario
            message_text = message_data.get('text', '')
            is_calendar_intent = check_calendar_intent(message_text, user_id, conversation_id, room, message_id)
            
            # Se il messaggio è per John Doe E NON è un intento calendario, procedi con l'inferenza standard
            if int(user_id) == 2 and not is_calendar_intent:
                # Mostra indicatore di digitazione
                emit('modelInference', {
                    'status': 'started',
                    'userId': 2
                }, room=room)

                try:
                    # Get AI response (Resta del codice originale...)
                    ai_response = get_llm_response(message_data.get('text', ''))

                    # Simulate typing delay
                    time.sleep(1.5)

                    # Get AI user data from database
                    ai_user = db.query(User).filter(User.id == 2).first()
                    print(f"AI user data from database: {ai_user.username if ai_user else 'Not found'}")

                    # Create response message - MODIFICATO PER INCLUDERE reply_to_id
                    ai_message = Message(
                        conversation_id=conversation_id,
                        user_id=2,
                        text=ai_response,
                        message_type='normal',
                        reply_to_id=message_id  # Aggiungiamo message_id come reply_to_id
                    )
                    db.add(ai_message)
                    db.commit()
                    db.refresh(ai_message)
                    
                    ai_message_id = ai_message.id
                    ai_created_at = ai_message.created_at

                    # Recuperiamo i dettagli del messaggio a cui stiamo rispondendo
                    reply_message = db.query(Message).get(message_id)
                    reply_message_user = db.query(User).get(reply_message.user_id)
                    
                    # Prepara l'oggetto replyTo
                    reply_to = None
                    if reply_message:
                        # Costruisci l'oggetto reply
                        reply_to = {
                            'id': reply_message.id,
                            'text': reply_message.text,
                            'message_type': reply_message.message_type,
                            'fileData': reply_message.file_data,
                            'user': {
                                'id': reply_message_user.id,
                                'username': reply_message_user.username,
                                'displayName': reply_message_user.display_name,
                                'avatarUrl': reply_message_user.avatar_url,
                                'status': reply_message_user.status
                            }
                        }

                    # Send AI response with user data from database
                    ai_message_dict = {
                        'id': ai_message_id,
                        'conversationId': conversation_id,
                        'user': {
                            'id': ai_user.id,
                            'username': ai_user.username,
                            'displayName': ai_user.display_name,
                            'avatarUrl': ai_user.avatar_url,
                            'status': ai_user.status
                        },
                        'text': ai_response,
                        'timestamp': ai_created_at.isoformat(),
                        'type': 'normal',
                        'fileData': None,
                        'replyTo': reply_to,  # Includiamo l'oggetto reply completo
                        'forwardedFrom': None,
                        'message_metadata': {},
                        'edited': False,
                        'editedAt': None,
                        'isOwn': False
                    }

                    print(f"Sending AI response with user data: {ai_message_dict['user']}")
                    emit('newMessage', prepare_for_socketio(ai_message_dict), room=room)
                finally:
                    # Hide typing indicator
                    emit('modelInference', {
                        'status': 'completed',
                        'userId': 2
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
        
        # Verifica se si tratta di un ID temporaneo
        if isinstance(message_id, str) and message_id.startswith('temp-'):
            print(f"Detected temporary ID: {message_id}, skipping database operation")
            
            # Per i messaggi temporanei, inviamo direttamente la conferma di eliminazione
            # poiché non sono ancora stati salvati nel database
            room = None
            if channel_name:
                room = f"channel:{channel_name}"
            elif user_id:
                room = f"dm:{user_id}"
            
            if room:
                emit('messageDeleted', {
                    'messageId': message_id,
                    'conversationId': None  # Non abbiamo un conversationId per messaggi temporanei
                }, room=room)
                print(f"Notified deletion of temporary message {message_id}")
            return
        
        # Solo se l'ID è un intero valido, procediamo con la cancellazione dal database
        try:
            # Assicuriamoci che message_id sia un intero
            message_id = int(message_id)
        except (ValueError, TypeError):
            print(f"Error: Invalid message ID format: {message_id}")
            return
        
        with get_db() as db:
            try:
                # Prima verifica che il messaggio appartenga all'utente (sicurezza)
                message = (
                    db.query(Message, Conversation)
                    .join(Conversation, Message.conversation_id == Conversation.id)
                    .filter(
                        Message.id == message_id,
                        Message.user_id == 1  # Solo messaggi dell'utente corrente
                    )
                    .first()
                )
                
                if not message:
                    print(f"Error: Message {message_id} not found or not owned by current user")
                    return
                
                message, conversation = message
                
                # Elimina il messaggio dal database
                db.delete(message)
                db.commit()
                
                print(f"Successfully deleted message {message_id} from database")
                
                # Determina la stanza per l'emissione dell'evento
                if conversation.type == 'channel':
                    room = f"channel:{conversation.name}"
                else:  # Direct message
                    # Trova l'altro partecipante alla conversazione
                    participant = (
                        db.query(ConversationParticipant)
                        .filter(
                            ConversationParticipant.conversation_id == conversation.id,
                            ConversationParticipant.user_id != 1
                        )
                        .first()
                    )
                    
                    if participant:
                        room = f"dm:{participant.user_id}"
                    else:
                        # Fallback alla conversazione
                        room = f"conversation:{conversation.id}"
                
                # Invia evento di eliminazione a tutti nella stanza
                emit('messageDeleted', {
                    'messageId': message_id,
                    'conversationId': conversation.id
                }, room=room)
            except Exception as e:
                db.rollback()
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
        
        # Verifica se si tratta di un ID temporaneo
        if isinstance(message_id, str) and message_id.startswith('temp-'):
            print(f"Cannot edit temporary message with ID: {message_id}")
            # Non possiamo modificare un messaggio che non è ancora stato salvato nel database
            return
        
        # Solo se l'ID è un intero valido, procediamo con la modifica nel database
        try:
            # Assicuriamoci che message_id sia un intero
            message_id = int(message_id)
        except (ValueError, TypeError):
            print(f"Error: Invalid message ID format: {message_id}")
            return
        
        with get_db() as db:
            try:
                # Prima verifica che il messaggio appartenga all'utente (sicurezza)
                message = (
                    db.query(Message, Conversation)
                    .join(Conversation, Message.conversation_id == Conversation.id)
                    .filter(
                        Message.id == message_id,
                        Message.user_id == 1  # Solo messaggi dell'utente corrente
                    )
                    .first()
                )
                
                if not message:
                    print(f"Error: Message {message_id} not found or not owned by current user")
                    return
                
                message, conversation = message
                
                # Aggiorna il messaggio nel database
                message.text = new_text
                message.edited = True
                message.edited_at = datetime.now()
                db.commit()
                
                edited_at = message.edited_at
                
                # Determina la stanza per l'emissione dell'evento
                if conversation.type == 'channel':
                    room = f"channel:{conversation.name}"
                else:  # Direct message
                    # Trova l'altro partecipante alla conversazione
                    participant = (
                        db.query(ConversationParticipant)
                        .filter(
                            ConversationParticipant.conversation_id == conversation.id,
                            ConversationParticipant.user_id != 1
                        )
                        .first()
                    )
                    
                    if participant:
                        room = f"dm:{participant.user_id}"
                    else:
                        # Fallback alla conversazione
                        room = f"conversation:{conversation.id}"
                
                # Invia evento di modifica a tutti nella stanza
                emit('messageEdited', {
                    'messageId': message_id,
                    'conversationId': conversation.id,
                    'newText': new_text,
                    'editedAt': edited_at.isoformat()
                }, room=room)
                
                print(f"Successfully updated message {message_id} and broadcasted to {room}")
            except Exception as e:
                db.rollback()
                print(f"Error during message edit: {str(e)}")

    @socketio.on('userStartTyping')
    def handle_start_typing(data):
        """Handle user typing event start"""
        print(f"Received typing start event: {data}")
        channelName = data.get('channelName')
        userId = data.get('userId')
        isDirect = data.get('isDirect', False)
        
        # Determina la stanza corretta
        room = None
        if isDirect:
            # Per messaggi diretti, invia all'altro utente
            room = f"dm:{userId}"
        elif channelName:
            # Per canali, invia a tutti nel canale
            room = f"channel:{channelName}"
        
        if not room:
            print("Error: Could not determine room for typing event")
            return
            
        # Trova l'utente corrente (ID 1)
        with get_db() as db:
            current_user = db.query(User).filter(User.id == 1).first()
            if not current_user:
                print("Error: Current user not found")
                return
                
            # Propaga l'evento agli altri utenti nella stanza, escludendo mittente
            emit('userStartTyping', {
                'userId': current_user.id,  # ID utente che sta digitando
                'isDirect': isDirect
            }, room=room, include_self=False)
            print(f"Broadcast typing start event to room {room}")

    @socketio.on('userStopTyping')
    def handle_stop_typing(data):
        """Handle user typing event stop"""
        print(f"Received typing stop event: {data}")
        channelName = data.get('channelName')
        userId = data.get('userId')
        isDirect = data.get('isDirect', False)
        
        # Determina la stanza corretta
        room = None
        if isDirect:
            # Per messaggi diretti, invia all'altro utente
            room = f"dm:{userId}"
        elif channelName:
            # Per canali, invia a tutti nel canale
            room = f"channel:{channelName}"
        
        if not room:
            print("Error: Could not determine room for typing event")
            return
            
        # Trova l'utente corrente (ID 1)
        with get_db() as db:
            current_user = db.query(User).filter(User.id == 1).first()
            if not current_user:
                print("Error: Current user not found")
                return
                
            # Propaga l'evento agli altri utenti nella stanza, escludendo mittente
            emit('userStopTyping', {
                'userId': current_user.id,  # ID utente che ha smesso di digitare
                'isDirect': isDirect
            }, room=room, include_self=False)
            print(f"Broadcast typing stop event to room {room}")                

def ensure_channel_conversations_exist():
    """Ensure that all channels have corresponding conversations in the database"""
    with get_db() as db:
        try:
            # Ottieni tutti i canali
            channels = db.query(Channel).all()

            for channel in channels:
                # Verifica se esiste già una conversazione per questo canale
                conversation = (
                    db.query(Conversation)
                    .filter(
                        Conversation.name == channel.name, 
                        Conversation.type == 'channel'
                    )
                    .first()
                )

                if not conversation:
                    # Crea la conversazione se non esiste
                    conversation = Conversation(
                        name=channel.name,
                        type='channel'
                    )
                    db.add(conversation)
                    db.commit()
                    db.refresh(conversation)
                    print(f"Created missing conversation for channel {channel.name} with ID {conversation.id}")

                    # Aggiungi almeno un messaggio di sistema per inizializzare la conversazione
                    welcome_message = Message(
                        conversation_id=conversation.id,
                        user_id=2,  # ID utente di sistema (John Doe)
                        text=f"Welcome to the #{channel.name} channel!",
                        message_type='system'
                    )
                    db.add(welcome_message)
                    db.commit()
                    print(f"Added welcome message to channel {channel.name}")
        finally:
            db.close()
