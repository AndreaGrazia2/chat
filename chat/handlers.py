# Update imports
from datetime import datetime
from flask_socketio import emit, join_room, leave_room
import time
import json
import requests
import re
import traceback
from sentence_transformers import SentenceTransformer
from common.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
import psycopg2
import psycopg2.extras

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

        # Check if Database Agent user exists
        db_agent_user = db.query(User).filter(User.id == 3).first()
        if not db_agent_user:
            db_agent_user = User(
                id=3,
                username='dbagent',
                display_name='Database Agent',
                avatar_url='https://ui-avatars.com/api/?name=DB+Agent&background=4A235A&color=fff',
                status='online'
            )
            db.add(db_agent_user)
            db.commit()
            print("Created Database Agent user")
        else:
            # Update Database Agent user
            db_agent_user.username = 'dbagent'
            db_agent_user.display_name = 'Database Agent'
            db_agent_user.avatar_url = 'https://ui-avatars.com/api/?name=DB+Agent&background=4A235A&color=fff'
            db_agent_user.status = 'online'
            db.commit()
            print("Updated Database Agent user")

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
                .filter(
                    Message.conversation_id == conversation_id,
                    Message.message_type != 'memory'  # Escludi i messaggi di tipo memory
                )
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
                .filter(
                    Message.conversation_id == conversation_id,
                    Message.message_type != 'memory'  # Escludi i messaggi di tipo memory
                )
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

        # Verifica per messaggi di tipo file (aggiunto nuovo controllo)
        has_file = message_data.get('type') == 'file' and message_data.get('fileData')
        if not message_data.get('text') and not has_file:
            print(f"Error: Message without text or file data: {message_data}")
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
            
            # Verifica intento calendario per messaggi di canale
            message_text = message_data.get('text', '')
            is_calendar_intent = check_calendar_intent(message_text, None, conversation_id, room, message_id)
            
            # Verifica intento query database se non è un intento calendario
            is_db_query_intent = False
            if not is_calendar_intent:
                is_db_query_intent = check_db_query_intent(message_text, None, conversation_id, room, message_id)

                # Verifica intento analisi file se non è un altro intento e c'è un file allegato
                if not is_db_query_intent and has_file:
                    file_data = message_data.get('fileData', {})
                    check_file_analysis_intent(
                        message_text=message_text,
                        file_path=file_data.get('path'),
                        file_type=file_data.get('ext'),
                        user_id=None,
                        conversation_id=conversation_id,
                        room=room,
                        original_message_id=message_id
                    )                

    @socketio.on('directMessage')
    def handle_direct_message(data):
        """Handle direct message from client"""
        print(f"Received direct message: {data}")
        user_id = data.get('userId')
        message_data = data.get('message', {})

        # Verifica rigorosa che user_id sia un numero intero
        if user_id is None or not isinstance(user_id, int):
            print(f"Error: userId is not a valid integer: {user_id}")
            return

        # Verifica che il messaggio contenga testo o dati file
        has_file = message_data.get('type') == 'file' and isinstance(message_data.get('fileData'), dict)
        if not message_data.get('text') and not has_file:
            print(f"Error: Message doesn't contain text or file data: {message_data}")
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

            # Gestione dei dati del file
            file_data = message_data.get('fileData')
            
            # Se è un messaggio di tipo file ma non ha testo, usa un testo predefinito
            message_text = message_data.get('text', '')
            if message_data.get('type') == 'file' and not message_text:
                if file_data and isinstance(file_data, dict):
                    file_name = file_data.get('name', 'file')
                    file_ext = file_data.get('ext', '')
                    message_text = f"File: {file_name}.{file_ext}"
            
            # Create user message
            new_message = Message(
                conversation_id=conversation_id,
                user_id=1,  # current user id
                reply_to_id=reply_to_id,
                text=message_text,
                message_type=message_data.get('type', 'normal'),
                file_data=file_data,
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
                'text': message_text,
                'timestamp': created_at.isoformat(),
                'type': message_data.get('type', 'normal'),
                'fileData': file_data,
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
            
            # Verifica intento query database se non è un intento calendario
            is_db_query_intent = False
            if not is_calendar_intent:
                is_db_query_intent = check_db_query_intent(message_text, user_id, conversation_id, room, message_id)

            # Se il messaggio è per un utente e non sono stati rilevati altri intenti
            if int(user_id) > 0 and not is_calendar_intent and not is_db_query_intent:
                # Verifica se è un messaggio con file allegato
                has_file = message_data.get('type') == 'file' and message_data.get('fileData')
                if has_file:
                    file_data = message_data.get('fileData', {})
                    is_file_intent = check_file_analysis_intent(
                        message_text=message_text,
                        file_path=file_data.get('path'),
                        file_type=file_data.get('ext'),
                        user_id=user_id,
                        conversation_id=conversation_id,
                        room=room,
                        original_message_id=message_id
                    )
                    
                    # Se è un intento di analisi file, non procedere con l'inferenza standard
                    if is_file_intent:
                        return

                # Se il messaggio è per Jane Smith (ID 4) - AGENTE CON MEMORIA
                if int(user_id) == 4:
                    # Mostra indicatore di digitazione
                    emit('modelInference', {
                        'status': 'started',
                        'userId': 4
                    }, room=room)

                    try:
                        print(f"✅ ATTIVAZIONE AGENTE CON MEMORIA per Jane Smith (ID 4)")
                        
                        # 1. Recuperiamo o creiamo il messaggio di memoria
                        memory_message = None
                        memory_truncated = False
                        
                        # Cerchiamo un messaggio di tipo "memory" esistente per questa conversazione
                        memory_message = db.query(Message).filter(
                            Message.conversation_id == conversation_id,
                            Message.message_type == 'memory',
                            Message.user_id == 4
                        ).first()
                        
                        print(f"Ricerca memoria: conversation_id={conversation_id}, user_id=4")
                        
                        # Se non esiste, ne creiamo uno nuovo
                        if not memory_message:
                            print(f"⚠️ Nessun messaggio memory trovato, ne creo uno nuovo")
                            memory_message = Message(
                                conversation_id=conversation_id,
                                user_id=4,  # Jane Smith
                                text="Memory storage - non visualizzato",
                                message_type="memory",
                                message_metadata={
                                    "history": [],
                                    "agent_id": 4
                                }
                            )
                            db.add(memory_message)
                            db.commit()
                            db.refresh(memory_message)
                            print(f"✅ Nuovo messaggio memory creato con ID {memory_message.id}")
                        else:
                            print(f"✅ Trovato messaggio memory esistente con ID {memory_message.id}")
                            print(f"Stato attuale della memoria: {memory_message.message_metadata}")
                        
                        # 2. Gestiamo correttamente i metadati e la storia
                        if memory_message.message_metadata is None:
                            print("⚠️ message_metadata è None, inizializzo")
                            memory_message.message_metadata = {"history": []}
                        elif "history" not in memory_message.message_metadata:
                            print("⚠️ 'history' non trovato nei metadati, aggiungo")
                            # Creiamo una copia per evitare problemi di riferimento
                            updated_metadata = dict(memory_message.message_metadata)
                            updated_metadata["history"] = []
                            memory_message.message_metadata = updated_metadata
                        
                        # 3. Creiamo una copia del metadata per sicurezza
                        metadata_copy = dict(memory_message.message_metadata)
                        history = metadata_copy.get('history', [])
                        print(f"👁️ Recuperata storia conversazione con {len(history)} scambi")
                        
                        # 4. Costruiamo il prompt con la storia della conversazione
                        prompt = "Sei un assistente AI che:\n"
                        prompt += "- Fornisce risposte concise e utili\n"
                        prompt += "- Usa un tono amichevole e conversazionale\n"
                        prompt += "- Si ricorda delle conversazioni precedenti\n"
                        prompt += "- Risponde in italiano\n\n"

                        # Aggiungi istruzioni per identificare query al codice civile
                        prompt += "ISTRUZIONE SPECIALE:\n"
                        prompt += "Se la domanda riguarda temi legali o il Codice Civile italiano, aggiungi alla tua risposta:\n"
                        prompt += "[RAG_QUERY]{\"is_legal\":true,\"query\":\"query ottimizzata per ricerca\"}[/RAG_QUERY]\n"
                        prompt += "Dove \"query ottimizzata\" è una versione semplificata della domanda con termini rilevanti per il Codice Civile.\n"
                        prompt += "Se non riguarda temi legali, aggiungi: [RAG_QUERY]{\"is_legal\":false}[/RAG_QUERY]\n\n"
                        prompt += "ATTENZIONE, controlla sempre che il contenuto all'interno di [RAG_QUERY][/RAG_QUERY] sia formattato correttamente in JSON\n\n"                        
                        
                        # Aggiungiamo la storia solo se esiste
                        if history:
                            prompt += "Ecco la storia recente della conversazione:\n"
                            for exchange in history:
                                prompt += f"Utente: {exchange.get('user', '')}\n"
                                prompt += f"Jane: {exchange.get('bot', '')}\n\n"
                        
                        # Aggiungiamo il messaggio corrente
                        prompt += f"Utente: {message_text}\nJane:"
                        
                        print(f"📝 Prompt generato con {len(history)} scambi precedenti")
                        
                        # 5. Otteniamo la risposta dal modello
                        ai_response = get_llm_response(prompt)
                        print(f"✅ Risposta generata: {ai_response[:50]}...")

                        # Estrai informazioni RAG
                        rag_match = re.search(r'\[RAG_QUERY\](.*?)\[/RAG_QUERY\]', ai_response)
                        if rag_match:
                            try:
                                # Get the raw match
                                raw_match = rag_match.group(1)
                                print(f"RAG match found: {raw_match}")
                                
                                # Fix common JSON formatting errors
                                # Models often add an extra closing brace
                                if raw_match.count('{') < raw_match.count('}'):
                                    print(f"Fixing malformed JSON - removing extra closing braces")
                                    # More robust fix for extra closing braces
                                    raw_match = raw_match.replace('}}}', '}')
                                    raw_match = raw_match.replace('}}', '}')
                                    print(f"Fixed JSON: {raw_match}")
                                
                                rag_data = json.loads(raw_match)
                                print(f"Successfully parsed RAG data: {rag_data}")
                                
                                # Rimuovi il tag dalla risposta
                                ai_response = re.sub(r'\[RAG_QUERY\].*?\[/RAG_QUERY\]', '', ai_response).strip()
                                
                                # Se è una query legale, esegui ricerca e integra risultati
                                if rag_data.get('is_legal') and rag_data.get('query'):
                                    query = rag_data['query']
                                    print(f"Executing legal search for query: '{query}'")
                                    articles = search_semantica(query)
                                    
                                    if articles:
                                        ai_response += f"\n\n📚 **Riferimenti dal Codice Civile** (ricerca: '{query}'):\n\n"
                                        for article in articles:
                                            ai_response += f"**Articolo {article['article_number']}** (rilevanza: {article['similarity']}):\n"
                                            ai_response += f"{article['content']}\n\n"

                            except json.JSONDecodeError as e:
                                print(f"JSON decode error in RAG tag: {str(e)}")
                                print(f"Problematic JSON string: {rag_match.group(1)}")
                            except Exception as e:
                                print(f"Errore elaborazione tag RAG: {str(e)}")
                                import traceback
                                print(traceback.format_exc())
                        
                        # 6. Aggiorniamo la memoria
                        MAX_HISTORY = 5
                        history.append({
                            "user": message_text,
                            "bot": ai_response,
                            "timestamp": datetime.now().isoformat()
                        })
                        
                        # 7. Manteniamo solo gli ultimi MAX_HISTORY scambi
                        if len(history) > MAX_HISTORY:
                            print(f"⚠️ Memoria piena, rimuovo scambi più vecchi (max={MAX_HISTORY})")
                            history = history[-MAX_HISTORY:]
                            memory_truncated = True
                        
                        # 8. Aggiorniamo il messaggio memory
                        metadata_copy['history'] = history
                        metadata_copy['lastUpdated'] = datetime.now().isoformat()
                        memory_message.message_metadata = metadata_copy
                        db.commit()
                        print(f"✅ Memoria aggiornata con {len(history)} scambi")
                        
                        # Ritardo simulato per digitazione
                        time.sleep(1.5)

                        # 9. Otteniamo i dati utente dal database
                        ai_user = db.query(User).filter(User.id == 4).first()

                        # 10. Creiamo il messaggio di risposta
                        ai_message = Message(
                            conversation_id=conversation_id,
                            user_id=4,
                            text=ai_response,
                            message_type='normal',
                            reply_to_id=message_id
                        )
                        db.add(ai_message)
                        db.commit()
                        db.refresh(ai_message)
                        
                        ai_message_id = ai_message.id
                        ai_created_at = ai_message.created_at

                        # 11. Recuperiamo i dettagli del messaggio originale
                        reply_message = db.query(Message).get(message_id)
                        reply_message_user = db.query(User).get(reply_message.user_id)
                        
                        # Prepariamo l'oggetto replyTo
                        reply_to = None
                        if reply_message:
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

                        # 12. Inviamo la risposta al client
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
                            'replyTo': reply_to,
                            'forwardedFrom': None,
                            'message_metadata': {"agent_memory": True},
                            'edited': False,
                            'editedAt': None,
                            'isOwn': False
                        }

                        emit('newMessage', prepare_for_socketio(ai_message_dict), room=room)
                        
                        # 13. Se la memoria è stata troncata, inviamo un messaggio di sistema
                        if memory_truncated:
                            memory_notice = Message(
                                conversation_id=conversation_id,
                                user_id=4,
                                text="Memoria della conversazione azzerata. La cronologia precedente non sarà più considerata.",
                                message_type='system'
                            )
                            db.add(memory_notice)
                            db.commit()
                            db.refresh(memory_notice)
                            
                            notice_dict = {
                                'id': memory_notice.id,
                                'conversationId': conversation_id,
                                'user': {
                                    'id': ai_user.id,
                                    'username': ai_user.username,
                                    'displayName': ai_user.display_name,
                                    'avatarUrl': ai_user.avatar_url,
                                    'status': ai_user.status
                                },
                                'text': memory_notice.text,
                                'timestamp': memory_notice.created_at.isoformat(),
                                'type': 'system',
                                'fileData': None,
                                'replyTo': None,
                                'forwardedFrom': None,
                                'message_metadata': {},
                                'edited': False,
                                'editedAt': None,
                                'isOwn': False
                            }
                            
                            emit('newMessage', prepare_for_socketio(notice_dict), room=room)
                            
                    except Exception as e:
                        print(f"❌ ERRORE nell'agente memoria Jane Smith: {str(e)}")
                        print(traceback.format_exc())
                        
                        # Risposta di fallback senza memoria in caso di errore
                        try:
                            ai_response = get_llm_response(message_text)
                            ai_user = db.query(User).filter(User.id == 4).first()
                            
                            ai_message = Message(
                                conversation_id=conversation_id,
                                user_id=4,
                                text=ai_response,
                                message_type='normal',
                                reply_to_id=message_id
                            )
                            db.add(ai_message)
                            db.commit()
                            db.refresh(ai_message)
                            
                            ai_message_dict = {
                                'id': ai_message.id,
                                'conversationId': conversation_id,
                                'user': {
                                    'id': ai_user.id,
                                    'username': ai_user.username,
                                    'displayName': ai_user.display_name,
                                    'avatarUrl': ai_user.avatar_url,
                                    'status': ai_user.status
                                },
                                'text': f"{ai_response}\n\n(Nota: risposta senza memoria per un errore temporaneo)",
                                'timestamp': ai_message.created_at.isoformat(),
                                'type': 'normal',
                                'replyTo': None,
                                'fileData': None,
                                'forwardedFrom': None,
                                'message_metadata': {},
                                'edited': False,
                                'editedAt': None,
                                'isOwn': False
                            }
                            
                            emit('newMessage', prepare_for_socketio(ai_message_dict), room=room)
                        except Exception as fallback_error:
                            print(f"❌ ERRORE anche nel fallback: {str(fallback_error)}")
                    finally:
                        # Nascondiamo l'indicatore di digitazione
                        emit('modelInference', {
                            'status': 'completed',
                            'userId': 4
                        }, room=room)

                # Se il messaggio è per John Doe
                elif int(user_id) == 2:
                    # Mostra indicatore di digitazione
                    emit('modelInference', {
                        'status': 'started',
                        'userId': 2
                    }, room=room)

                    try:
                        # Get AI response
                        ai_response = get_llm_response(message_data.get('text', ''))

                        # Simulate typing delay
                        time.sleep(1.5)

                        # Get AI user data from database
                        ai_user = db.query(User).filter(User.id == 2).first()
                        print(f"AI user data from database: {ai_user.username if ai_user else 'Not found'}")

                        # Create response message
                        ai_message = Message(
                            conversation_id=conversation_id,
                            user_id=2,
                            text=ai_response,
                            message_type='normal',
                            reply_to_id=message_id
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
                            'replyTo': reply_to,
                            'forwardedFrom': None,
                            'message_metadata': {},
                            'edited': False,
                            'editedAt': None,
                            'isOwn': False
                        }

                        print(f"Sending AI response with user data: {ai_message_dict['user']}")
                        emit('newMessage', prepare_for_socketio(ai_message_dict), room=room)

                        if ai_user.id == 2:
                            # Broadcast del messaggio a tutti i client 
                            emit('newMessage', prepare_for_socketio(ai_message_dict), broadcast=True)
                    finally:
                        # Hide typing indicator
                        emit('modelInference', {
                            'status': 'completed',
                            'userId': 2
                        }, room=room)

    @socketio.on('channelMessage')
    def handle_channel_message(data):
        """Handle channel message from client"""
        channel_name = data.get('channelName')
        message_data = data.get('message')

        print(f"Received channel message: {data}")

        if not channel_name or not message_data:
            print("Missing channel name or message data")
            return

        # Verifica per messaggi di tipo file (aggiunto nuovo controllo)
        has_file = message_data.get('type') == 'file' and message_data.get('fileData')
        if not message_data.get('text') and not has_file:
            print(f"Error: Message without text or file data: {message_data}")
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

            # Per messaggi di tipo file, assicura che ci sia sempre un testo
            file_data = message_data.get('fileData')
            message_text = message_data.get('text', '')
            
            if message_data.get('type') == 'file' and not message_text:
                if file_data and isinstance(file_data, dict):
                    file_name = file_data.get('name', 'file')
                    file_ext = file_data.get('ext', '')
                    message_text = f"File: {file_name}.{file_ext}"

            # Create new message with better error handling
            try:
                new_message = Message(
                    conversation_id=conversation_id,
                    user_id=1,  # current user id
                    reply_to_id=reply_to_id,
                    text=message_text,
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
                'text': message_text,
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
            
            # Verifica intento calendario per messaggi di canale
            message_text = message_data.get('text', '')
            is_calendar_intent = check_calendar_intent(message_text, None, conversation_id, room, message_id)
            
            # Verifica intento query database se non è un intento calendario
            is_db_query_intent = False
            if not is_calendar_intent:
                is_db_query_intent = check_db_query_intent(message_text, None, conversation_id, room, message_id)

                # Verifica intento analisi file se non è un altro intento e c'è un file allegato
                if not is_db_query_intent and has_file:
                    file_data = message_data.get('fileData', {})
                    check_file_analysis_intent(
                        message_text=message_text,
                        file_path=file_data.get('path'),
                        file_type=file_data.get('ext'),
                        user_id=None,
                        conversation_id=conversation_id,
                        room=room,
                        original_message_id=message_id
                    )   

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

def check_db_query_intent(message_text, user_id, conversation_id, room, original_message_id=None):
    """
    Verifica se il messaggio contiene un intento di query database e invia la risposta appropriata
    
    Args:
        message_text: Testo del messaggio
        user_id: ID dell'utente destinatario (per messaggi diretti)
        conversation_id: ID della conversazione
        room: Room Socket.IO per emettere eventi
        original_message_id: ID del messaggio a cui rispondere
        
    Returns:
        bool: True se è un intento database, False altrimenti
    """
    # Importa il middleware dell'agente database
    from agent.db_agent import DBAgentMiddleware, get_db_query_agent
    
    # Inizializza il middleware
    db_middleware = DBAgentMiddleware()
    
    # Verifica se è un intento database usando il pattern matching
    if db_middleware.detect_db_query_intent(message_text):
        # Emetti evento modelInference 'started' all'inizio dell'elaborazione
        emit('modelInference', {'status': 'started', 'userId': user_id or 3}, room=room)
        
        # Processa il messaggio attraverso l'agente database
        agent_result = db_middleware.process_message(message_text, original_message_id, user_id, conversation_id)
        
        # Se abbiamo una risposta, inviala
        if agent_result and agent_result.get('response'):
            with get_db() as db:
                # Ottieni dati utente DB Agent dal database
                db_agent_user = db.query(User).filter(User.id == 3).first()
                
                # Prepara i dati del file se disponibili
                file_data = agent_result.get('file_data')
                
                # Crea messaggio di risposta con reply_to_id
                db_agent_message = Message(
                    conversation_id=conversation_id,
                    user_id=3,  # Database Agent
                    text=agent_result.get('response'),
                    message_type='normal',
                    reply_to_id=original_message_id,  # Imposta il riferimento al messaggio originale
                    file_data=file_data,  # Aggiungi i dati del file
                    message_metadata={'db_query_intent': True}  # Aggiungiamo un flag per tracciare
                )
                db.add(db_agent_message)
                db.commit()
                db.refresh(db_agent_message)
                
                db_message_id = db_agent_message.id
                db_created_at = db_agent_message.created_at
                
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
                db_message_dict = {
                    'id': db_message_id,
                    'conversationId': conversation_id,
                    'user': {
                        'id': db_agent_user.id,
                        'username': db_agent_user.username,
                        'displayName': db_agent_user.display_name,
                        'avatarUrl': db_agent_user.avatar_url,
                        'status': db_agent_user.status
                    },
                    'text': agent_result.get('response'),
                    'timestamp': db_created_at.isoformat(),
                    'type': 'normal',
                    'fileData': file_data,  # Aggiungi i dati del file
                    'replyTo': reply_to,  # Aggiungi il riferimento al messaggio originale
                    'forwardedFrom': None,
                    'message_metadata': {'db_query_intent': True},  # Aggiungiamo un flag per tracciare
                    'edited': False,
                    'editedAt': None,
                    'isOwn': False
                }
                
                print(f"Invio risposta dell'agente database: {db_message_dict}")
                emit('newMessage', prepare_for_socketio(db_message_dict), room=room)
                print(f"Inviata risposta dell'agente database per la query: '{message_text}'")
            
            # Emetti evento modelInference 'completed' prima di restituire True
            emit('modelInference', {'status': 'completed', 'userId': user_id or 3}, room=room)
            return True
    
    # Emetti evento modelInference 'completed' anche se non è un intento database
    emit('modelInference', {'status': 'completed', 'userId': user_id or 3}, room=room)
    return False

# Add this function to your handlers.py file

"""
Funzione per verificare e gestire gli intenti di analisi file nei messaggi
Questa implementazione dovrebbe essere inserita nel file chat/handlers.py
"""

def check_file_analysis_intent(message_text, file_path, file_type, user_id, conversation_id, room, original_message_id=None):
    """
    Verifica se il messaggio contiene un intento di analisi file e invia la risposta appropriata
    
    Args:
        message_text: Testo del messaggio
        file_path: Percorso del file allegato
        file_type: Tipo MIME del file
        user_id: ID dell'utente destinatario
        conversation_id: ID della conversazione
        room: Room Socket.IO per emettere eventi
        original_message_id: ID del messaggio a cui rispondere
        
    Returns:
        bool: True se è un intento di analisi file, False altrimenti
    """
    # Importa il middleware dell'agente file
    from agent.file_agent.file_agent_middleware import FileAgentMiddleware

    print(f"Verifica intento analisi file per: '{message_text}'")
    print(f"File path: {file_path}, File type: {file_type}")    
    
    # Inizializza il middleware
    file_middleware = FileAgentMiddleware()
    
    # Verifica se è un intento di analisi file usando il modello di linguaggio
    is_file_intent = file_middleware.detect_file_analysis_intent(message_text)
    print(f"Intento analisi file rilevato: {is_file_intent}")
    
    if is_file_intent:
        # Emetti evento modelInference 'started' all'inizio dell'elaborazione
        emit('modelInference', {'status': 'started', 'userId': user_id or 7}, room=room)
        
        # Processa il messaggio attraverso l'agente file
        print(f"Elaborazione messaggio attraverso agente file")
        agent_result = file_middleware.process_message(
            message_text=message_text,
            message_id=original_message_id,
            user_id=user_id,
            conversation_id=conversation_id,
            file_data={
                'path': file_path,
                'ext': file_type
            }
        )
        
        print(f"Risultato agente file: {agent_result}")

        # Se abbiamo una risposta, inviala
        if agent_result and agent_result.get('response'):
            with get_db() as db:
                # Ottieni dati utente File Agent dal database
                file_agent_user = db.query(User).filter(User.id == 7).first()
                
                # Se l'utente file agent non esiste, crealo
                if not file_agent_user:
                    file_agent_user = User(
                        id=7, 
                        username='file_agent',
                        display_name='File Analysis',
                        avatar_url='https://ui-avatars.com/api/?name=File+Analysis&background=3698D3&color=fff',
                        status='online'
                    )
                    db.add(file_agent_user)
                    db.commit()
                    db.refresh(file_agent_user)
                
                # Crea messaggio di risposta con reply_to_id
                file_agent_message = Message(
                    conversation_id=conversation_id,
                    user_id=7,  # File Analysis Agent
                    text=agent_result.get('response'),
                    message_type='normal',
                    reply_to_id=original_message_id,  # Imposta il riferimento al messaggio originale
                    message_metadata={'file_analysis_intent': True}  # Aggiungiamo un flag per tracciare
                )
                db.add(file_agent_message)
                db.commit()
                db.refresh(file_agent_message)
                
                file_message_id = file_agent_message.id
                file_created_at = file_agent_message.created_at
                
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
                file_message_dict = {
                    'id': file_message_id,
                    'conversationId': conversation_id,
                    'user': {
                        'id': file_agent_user.id,
                        'username': file_agent_user.username,
                        'displayName': file_agent_user.display_name,
                        'avatarUrl': file_agent_user.avatar_url,
                        'status': file_agent_user.status
                    },
                    'text': agent_result.get('response'),
                    'timestamp': file_created_at.isoformat(),
                    'type': 'normal',
                    'fileData': None,
                    'replyTo': reply_to,  # Aggiungi il riferimento al messaggio originale
                    'forwardedFrom': None,
                    'message_metadata': {'file_analysis_intent': True},
                    'edited': False,
                    'editedAt': None,
                    'isOwn': False
                }
                
                emit('newMessage', prepare_for_socketio(file_message_dict), room=room)
                
                # Emetti evento modelInference 'completed' alla fine dell'elaborazione
                emit('modelInference', {'status': 'completed', 'userId': user_id or 7}, room=room)
                
                return True
        
        # Se non abbiamo una risposta ma è comunque un intento file, emetti completed
        emit('modelInference', {'status': 'completed', 'userId': user_id or 7}, room=room)
        return agent_result.get('is_file_intent', False)
    
    return False

def search_semantica(query, top_k=3):
    """Esegue ricerca semantica nella tabella codice_civile"""
    try:
        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        query_embedding = model.encode(query).tolist()
        
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME, 
            user=DB_USER, password=DB_PASSWORD
        )
        cur = conn.cursor()
        
        cur.execute("""
        SELECT article_number, content, 1 - (embedding <=> %s::vector) AS similarity
        FROM codice_civile
        ORDER BY embedding <=> %s::vector
        LIMIT %s;
        """, (query_embedding, query_embedding, top_k))
        
        results = cur.fetchall()
        articles = []
        
        for article_number, content, similarity in results:
            articles.append({
                "article_number": article_number,
                "content": content[:500] + "..." if len(content) > 500 else content,
                "similarity": round(similarity, 4)
            })
        
        cur.close()
        conn.close()
        return articles
    except Exception as e:
        print(f"Errore ricerca semantica: {str(e)}")
        return []
        