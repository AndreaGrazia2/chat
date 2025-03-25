from flask import Blueprint, render_template, jsonify, request, send_from_directory
from common.config import SECRET_KEY
from sqlalchemy import and_, or_, func, desc
from chat.models import User, Conversation, Message, Channel, ChannelMember, ConversationParticipant, MessageReadStatus
from chat.database import SessionLocal
import json
from datetime import datetime

from contextlib import contextmanager
from common.db.connection import get_db_session

@contextmanager
def get_db():
    """Context manager per ottenere una sessione del database"""
    with get_db_session(SessionLocal) as db:
        yield db

# Custom JSON encoder to handle special types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        # Add other special type handling here if needed
        return super().default(obj)

# Function to safely convert data to JSON
def safe_json(data):
    return json.dumps(data, cls=CustomJSONEncoder)

# Create a Blueprint for chat
chat_bp = Blueprint('chat', __name__, 
                    template_folder='templates',
                    static_folder='static',
                    static_url_path='/chat/static')

@chat_bp.route('/')
def index():
    """Render the main chat page"""
    return render_template('chat.html')

@chat_bp.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files for chat"""
    return send_from_directory('chat/static', filename)

@chat_bp.route('/api/messages/channel/<channel_name>')
def get_channel_messages(channel_name):
    """Get messages for a channel"""
    before_id = request.args.get('before_id')
    limit = int(request.args.get('limit', 50))
    
    try:
        with get_db() as db:
            # Trova la conversazione del canale usando SQLAlchemy
            conversation = (
                db.query(Conversation)
                .filter(Conversation.name == channel_name, Conversation.type == 'channel')
                .first()
            )
            
            if not conversation:
                # Ritorna una lista vuota invece di provocare un errore
                print(f"Warning: No conversation found for channel {channel_name}")
                return jsonify([])
                
            conversation_id = conversation.id
            
            # Costruisci la query SQLAlchemy base
            query = (
                db.query(Message, User)
                .join(User, Message.user_id == User.id)
                .filter(Message.conversation_id == conversation_id)
            )
            
            # Aggiunta filtro paginazione
            if before_id:
                query = query.filter(Message.id < before_id)
                
            # Ordina e limita
            query = query.order_by(desc(Message.created_at)).limit(limit)
            
            # Esegui la query
            messages = query.all()
            
            # Converti in formato per il frontend
            message_list = []
            
            # Crea un dizionario per tenere traccia dei messaggi per riferimento
            reply_messages = {}
            reply_ids = [msg.reply_to_id for msg, _ in messages if msg.reply_to_id]
            
            # Carica tutti i messaggi citati in un'unica query (per performance)
            if reply_ids:
                reply_msg_users = (
                    db.query(Message, User)
                    .join(User, Message.user_id == User.id)
                    .filter(Message.id.in_(reply_ids))
                    .all()
                )
                
                for reply, user in reply_msg_users:
                    # Prepara il messaggio di risposta per il riferimento
                    reply_messages[reply.id] = {
                        'id': reply.id,
                        'text': reply.text,
                        'message_type': reply.message_type,
                        'fileData': reply.file_data,
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'displayName': user.display_name,
                            'avatarUrl': user.avatar_url,
                            'status': user.status
                        }
                    }
            
            for msg, user in messages:
                try:
                    # Gestisce il messaggio di risposta
                    reply_to = None
                    if msg.reply_to_id and msg.reply_to_id in reply_messages:
                        reply_to = reply_messages[msg.reply_to_id]
                    
                    # Costruisci un dizionario base con valori di default
                    message_dict = {
                        'id': msg.id,
                        'conversationId': msg.conversation_id,
                        'user': {
                            'id': user.id,
                            'username': user.username or 'unknown',
                            'displayName': user.display_name or 'Unknown User',
                            'avatarUrl': user.avatar_url or 'https://ui-avatars.com/api/?name=Unknown',
                            'status': user.status or 'offline'
                        },
                        'text': msg.text or '',
                        'timestamp': msg.created_at.isoformat() if msg.created_at else None,
                        'type': msg.message_type or 'normal',
                        'fileData': msg.file_data,
                        'replyTo': reply_to,
                        'forwardedFrom': None,  # Si potrebbe espandere anche questo se necessario
                        'message_metadata': msg.message_metadata or {},
                        'edited': msg.edited,
                        'editedAt': msg.edited_at.isoformat() if msg.edited_at else None,
                        'isOwn': msg.user_id == 1
                    }
                    message_list.append(message_dict)
                except Exception as field_error:
                    print(f"Error processing message {msg.id} for channel {channel_name}: {str(field_error)}")
                    print(f"Message data: {msg}")
                    # Continua con il prossimo messaggio invece di far fallire tutto
                    continue
            
            # Inverti per mostrare i messaggi più vecchi prima
            message_list.reverse()
    
            try:
                # Serializza e poi deserializza per garantire compatibilità JSON
                serialized_data = safe_json(message_list)
                return jsonify(json.loads(serialized_data))
            except Exception as json_error:
                print(f"Error serializing messages for channel {channel_name}: {str(json_error)}")
                return jsonify([])
            
    except Exception as e:
        print(f"Error getting channel messages for {channel_name}: {str(e)}")
        # Ritorna un errore più amichevole e informativo
        return jsonify({
            'error': 'Could not load messages',
            'details': str(e),
            'channel': channel_name
        }), 500

@chat_bp.route('/api/messages/dm/<int:user_id>')
def get_dm_messages(user_id):
    """Get direct messages with a specific user"""
    before_id = request.args.get('before_id')
    limit = int(request.args.get('limit', 50))
    
    try:
        with get_db() as db: 
            # Find the DM conversation using SQLAlchemy
            # Usa una sottoquery per trovare le conversazioni dirette
            # dove entrambi gli utenti sono partecipanti
            current_user_convs = (
                db.query(ConversationParticipant.conversation_id)
                .filter(ConversationParticipant.user_id == 1)
                .subquery()
            )
            
            target_user_convs = (
                db.query(ConversationParticipant.conversation_id)
                .filter(ConversationParticipant.user_id == user_id)
                .subquery()
            )
            
            conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.type == 'direct',
                    Conversation.id.in_(current_user_convs),
                    Conversation.id.in_(target_user_convs)
                )
                .first()
            )
            
            if not conversation:
                return jsonify([])
                
            conversation_id = conversation.id
            
            # Build query to get messages using SQLAlchemy
            query = (
                db.query(Message, User)
                .join(User, Message.user_id == User.id)
                .filter(Message.conversation_id == conversation_id)
            )
            
            # Add pagination filter if specified
            if before_id:
                query = query.filter(Message.id < before_id)
                
            # Order and limit
            query = query.order_by(desc(Message.created_at)).limit(limit)
            
            # Execute query
            messages = query.all()
            
            # Carica tutti i messaggi di risposta in un'unica query per migliorare le performance
            reply_ids = [msg.reply_to_id for msg, _ in messages if msg.reply_to_id]
            reply_messages = {}
            
            if reply_ids:
                reply_msg_users = (
                    db.query(Message, User)
                    .join(User, Message.user_id == User.id)
                    .filter(Message.id.in_(reply_ids))
                    .all()
                )
                
                for reply, user in reply_msg_users:
                    reply_messages[reply.id] = {
                        'id': reply.id,
                        'text': reply.text,
                        'message_type': reply.message_type,
                        'fileData': reply.file_data,
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'displayName': user.display_name,
                            'avatarUrl': user.avatar_url,
                            'status': user.status
                        }
                    }
            
            # Convert to frontend format
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
            
            # Reverse order to show oldest messages first
            message_list.reverse()
            
            # Use safe_json to ensure all data is properly serialized
            return jsonify(json.loads(safe_json(message_list)))
            
    except Exception as e:
        print(f"Error getting DM messages: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/users')
def get_users():
    """Get all users"""
    try:
        with get_db() as db: 
            # Query usando SQLAlchemy
            users = db.query(User).order_by(User.display_name).all()
            
            # Converti in lista di dizionari
            user_list = [
                {
                    "id": user.id,
                    "username": user.username,
                    "displayName": user.display_name,
                    "avatarUrl": user.avatar_url,
                    "status": user.status
                }
                for user in users
            ]
            
            return jsonify(user_list)

    except Exception as e:
        print(f"Error getting users: {str(e)}")
        return jsonify({'error': str(e)}), 500
 
@chat_bp.route('/api/channels')
def get_channels():
    """Get all channels"""
    try:
        with get_db() as db:
            # Query con SQLAlchemy usando join e group by
            from sqlalchemy import func
            
            channels_with_counts = (
                db.query(Channel, func.count(ChannelMember.user_id).label('member_count'))
                .outerjoin(ChannelMember, Channel.id == ChannelMember.channel_id)
                .group_by(Channel.id)
                .order_by(Channel.name)
                .all()
            )
            
            channel_list = []
            for channel, member_count in channels_with_counts:
                channel_list.append({
                    "id": channel.id,
                    "name": channel.name,
                    "description": channel.description,
                    "isPrivate": channel.is_private,
                    "memberCount": member_count
                })
            
            return jsonify(channel_list)

    except Exception as e:
        print(f"Error getting channels: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/user/settings', methods=['GET', 'PUT'])
def user_settings():
    """Get or update user settings"""
    from chat.models import UserSetting
    
    user_id = 1  # Assume current user is ID 1
    
    if request.method == 'GET':
        try:
            with get_db() as db:  
                # Cerca le impostazioni dell'utente usando SQLAlchemy
                settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
                
                if not settings:
                    # Create default settings if not exist
                    settings = UserSetting(
                        user_id=user_id,
                        theme='light',
                        notification_enabled=True,
                        sound_enabled=True,
                        language='en',
                        timezone='UTC'
                    )
                    db.add(settings)
                    db.commit()
                    db.refresh(settings)
                
                # Add debug logging to see what theme is being returned
                print(f"Getting user settings, theme = {settings.theme}")
                
                return jsonify({
                    "theme": settings.theme,
                    "notificationEnabled": settings.notification_enabled,
                    "soundEnabled": settings.sound_enabled,
                    "language": settings.language,
                    "timezone": settings.timezone,
                    "settingsData": settings.settings_data or {}
                })

        except Exception as e:
            print(f"Error getting user settings: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            data = request.json
            
            # Add debug logging to see what theme is being saved
            print(f"Updating user settings, theme = {data.get('theme', 'light')}")
            
            with get_db() as db:
                # Cerca le impostazioni esistenti o crea un nuovo record
                settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
                
                if settings:
                    # Aggiorna un record esistente
                    settings.theme = data.get('theme', 'light')
                    settings.notification_enabled = data.get('notificationEnabled', True)
                    settings.sound_enabled = data.get('soundEnabled', True)
                    settings.language = data.get('language', 'en')
                    settings.timezone = data.get('timezone', 'UTC')
                    settings.settings_data = data.get('settingsData', {})
                else:
                    # Crea un nuovo record
                    settings = UserSetting(
                        user_id=user_id,
                        theme=data.get('theme', 'light'),
                        notification_enabled=data.get('notificationEnabled', True),
                        sound_enabled=data.get('soundEnabled', True),
                        language=data.get('language', 'en'),
                        timezone=data.get('timezone', 'UTC'),
                        settings_data=data.get('settingsData', {})
                    )
                    db.add(settings)
                
                db.commit()
                db.refresh(settings)
                
                # Verify the theme was properly saved
                print(f"Theme saved as: {settings.theme}")
                
                return jsonify({
                    "theme": settings.theme,
                    "notificationEnabled": settings.notification_enabled,
                    "soundEnabled": settings.sound_enabled,
                    "language": settings.language,
                    "timezone": settings.timezone,
                    "settingsData": settings.settings_data or {}
                })

        except Exception as e:
            print(f"Error updating user settings: {str(e)}")
            return jsonify({'error': str(e)}), 500      

@chat_bp.route('/api/conversations')
def get_conversations():
    """Get all conversations for the current user"""
    try:
        with get_db() as db:
            # Per conversazioni di tipo channel
            channel_convs = (
                db.query(
                    Conversation.id, 
                    Conversation.name, 
                    Conversation.type, 
                    Conversation.created_at,
                    func.count(Message.id).filter(
                        Message.user_id != 1,
                        ~Message.id.in_(
                            db.query(MessageReadStatus.message_id)
                            .filter(MessageReadStatus.user_id == 1)
                            .subquery()
                        )
                    ).label('unread_count'),
                    db.query(Message.created_at)
                    .filter(Message.conversation_id == Conversation.id)
                    .order_by(desc(Message.created_at))
                    .limit(1)
                    .scalar_subquery()
                    .label('last_activity')
                )
                .outerjoin(Message, Conversation.id == Message.conversation_id)
                .filter(Conversation.type == 'channel')
                .group_by(Conversation.id)
            )
            
            # Per conversazioni di tipo direct
            from sqlalchemy.sql import text, null
            
            # Subquery per trovare le conversazioni direct dell'utente corrente
            current_user_dm_convs = (
                db.query(ConversationParticipant.conversation_id)
                .join(Conversation, ConversationParticipant.conversation_id == Conversation.id)
                .filter(
                    ConversationParticipant.user_id == 1,
                    Conversation.type == 'direct'
                )
                .subquery()
            )
            
            # Trova l'altro utente in ogni conversazione direct
            direct_convs = (
                db.query(
                    Conversation.id, 
                    Conversation.name, 
                    Conversation.type, 
                    Conversation.created_at,
                    User.id.label('user_id'),
                    User.username,
                    User.display_name,
                    User.avatar_url,
                    User.status,
                    func.count(Message.id).filter(
                        Message.user_id != 1,
                        ~Message.id.in_(
                            db.query(MessageReadStatus.message_id)
                            .filter(MessageReadStatus.user_id == 1)
                            .subquery()
                        )
                    ).label('unread_count'),
                    db.query(Message.created_at)
                    .filter(Message.conversation_id == Conversation.id)
                    .order_by(desc(Message.created_at))
                    .limit(1)
                    .scalar_subquery()
                    .label('last_activity')
                )
                .join(ConversationParticipant, Conversation.id == ConversationParticipant.conversation_id)
                .join(User, ConversationParticipant.user_id == User.id)
                .outerjoin(Message, Conversation.id == Message.conversation_id)
                .filter(
                    Conversation.id.in_(current_user_dm_convs),
                    ConversationParticipant.user_id != 1,  # Non l'utente corrente
                    Conversation.type == 'direct'
                )
                .group_by(Conversation.id, User.id)
            )
            
            # Unione di tutte le conversazioni
            all_conversations = []
            
            # Aggiungi conversazioni channel
            for conv in channel_convs:
                all_conversations.append({
                    "id": conv.id,
                    "name": conv.name,
                    "type": conv.type,
                    "userId": None,
                    "displayName": conv.name,
                    "avatarUrl": None,
                    "status": None,
                    "unreadCount": conv.unread_count,
                    "lastActivity": conv.last_activity.isoformat() if conv.last_activity else None
                })
            
            # Aggiungi conversazioni direct
            for conv in direct_convs:
                all_conversations.append({
                    "id": conv.id,
                    "name": conv.name,
                    "type": conv.type,
                    "userId": conv.user_id,
                    "displayName": conv.display_name,
                    "avatarUrl": conv.avatar_url,
                    "status": conv.status,
                    "unreadCount": conv.unread_count,
                    "lastActivity": conv.last_activity.isoformat() if conv.last_activity else None
                })
            
            # Ordina per ultima attività
            all_conversations.sort(
                key=lambda x: x.get('lastActivity') or '1970-01-01',
                reverse=True
            )
            
            return jsonify(all_conversations)

    except Exception as e:
        print(f"Error getting conversations: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/search', methods=['GET'])
def search():
    """Search for messages, users, or channels"""
    query = request.args.get('q', '')
    search_type = request.args.get('type', 'all')  # all, messages, users, channels
    
    if not query:
        return jsonify({
            "messages": [],
            "users": [],
            "channels": []
        })
    
    try:
        results = {
            "messages": [],
            "users": [],
            "channels": []
        }
        
        with get_db() as db:
            # Search messages
            if search_type in ['all', 'messages']:
                messages = (
                    db.query(Message, User, Conversation)
                    .join(User, Message.user_id == User.id)
                    .join(Conversation, Message.conversation_id == Conversation.id)
                    .filter(Message.text.ilike(f"%{query}%"))
                    .filter(
                        # Solo messaggi delle conversazioni accessibili
                        (Conversation.type == 'channel') |
                        (
                            (Conversation.type == 'direct') &
                            Conversation.id.in_(
                                db.query(ConversationParticipant.conversation_id)
                                .filter(ConversationParticipant.user_id == 1)
                            )
                        )
                    )
                    .order_by(desc(Message.created_at))
                    .limit(10)
                    .all()
                )
                
                for msg, user, conv in messages:
                    results["messages"].append({
                        "id": msg.id,
                        "conversationId": msg.conversation_id,
                        "text": msg.text,
                        "timestamp": msg.created_at.isoformat(),
                        "user": {
                            "id": user.id,
                            "username": user.username,
                            "displayName": user.display_name,
                            "avatarUrl": user.avatar_url
                        },
                        "conversationType": conv.type,
                        "conversationName": conv.name
                    })
            
            # Search users
            if search_type in ['all', 'users']:
                users = (
                    db.query(User)
                    .filter(
                        User.username.ilike(f"%{query}%") | 
                        User.display_name.ilike(f"%{query}%")
                    )
                    .order_by(User.display_name)
                    .limit(10)
                    .all()
                )
                
                for user in users:
                    results["users"].append({
                        "id": user.id,
                        "username": user.username,
                        "displayName": user.display_name,
                        "avatarUrl": user.avatar_url,
                        "status": user.status
                    })
            
            # Search channels
            if search_type in ['all', 'channels']:
                channels = (
                    db.query(
                        Channel,
                        func.count(ChannelMember.user_id).label('member_count')
                    )
                    .outerjoin(ChannelMember, Channel.id == ChannelMember.channel_id)
                    .filter(
                        Channel.name.ilike(f"%{query}%") | 
                        Channel.description.ilike(f"%{query}%")
                    )
                    .group_by(Channel.id)
                    .order_by(Channel.name)
                    .limit(10)
                    .all()
                )
                
                for channel, member_count in channels:
                    results["channels"].append({
                        "id": channel.id,
                        "name": channel.name,
                        "description": channel.description,
                        "isPrivate": channel.is_private,
                        "memberCount": member_count
                    })
        
        return jsonify(results)
    except Exception as e:
        print(f"Error searching: {str(e)}")
        return jsonify({'error': str(e)}), 500
