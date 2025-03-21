from flask import Blueprint, render_template, jsonify, request, send_from_directory
from common.config import SECRET_KEY
from chat.db_models import User, Conversation, Message
from workflow.db.connection import get_db_cursor
import json

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
                return jsonify([])
                
            conversation_id = result['id']
            
            # Costruisci la query per ottenere i messaggi
            query = """
                SELECT m.id, m.conversation_id, m.user_id, m.reply_to_id, 
                       m.text, m.message_type, m.file_data, m.forwarded_from_id,
                       m.metadata, m.reactions, m.edited, m.edited_at, m.created_at,
                       u.username, u.display_name, u.avatar_url, u.status
                FROM chat_schema.messages m
                JOIN chat_schema.users u ON m.user_id = u.id
                WHERE m.conversation_id = %s
            """
            
            params = [conversation_id]
            
            # Aggiungi filtro per paginazione se specificato
            if before_id:
                query += " AND m.id < %s"
                params.append(before_id)
                
            # Ordina e limita
            query += " ORDER BY m.created_at DESC LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, params)
            messages = cursor.fetchall()
            
            # Converti in formato per il frontend
            message_list = []
            for msg in messages:
                # Gestisci messaggio a cui si risponde
                reply_to = None
                if msg['reply_to_id']:
                    try:
                        cursor.execute(
                            """
                            SELECT m.id, m.text, u.id as user_id, u.username, u.display_name, u.avatar_url
                            FROM chat_schema.messages m
                            JOIN chat_schema.users u ON m.user_id = u.id
                            WHERE m.id = %s
                            """,
                            (msg['reply_to_id'],)
                        )
                        reply_result = cursor.fetchone()
                        if reply_result:
                            reply_to = {
                                'id': msg['reply_to_id'],
                                'text': reply_result['text'],
                                'user': {
                                    'id': reply_result['user_id'],
                                    'username': reply_result['username'],
                                    'displayName': reply_result['display_name'],
                                    'avatarUrl': reply_result['avatar_url']
                                }
                            }
                    except Exception as e:
                        print(f"Error retrieving reply_to message: {e}")
                        reply_to = None
                
                # Gestisci messaggio inoltrato
                forwarded_from = None
                if msg['forwarded_from_id']:
                    try:
                        cursor.execute(
                            """
                            SELECT id, username, display_name, avatar_url
                            FROM chat_schema.users
                            WHERE id = %s
                            """,
                            (msg['forwarded_from_id'],)
                        )
                        forward_result = cursor.fetchone()
                        if forward_result:
                            forwarded_from = {
                                'id': forward_result['id'],
                                'username': forward_result['username'],
                                'displayName': forward_result['display_name'],
                                'avatarUrl': forward_result['avatar_url']
                            }
                    except Exception as e:
                        print(f"Error retrieving forwarded_from user: {e}")
                        forwarded_from = None
                
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
                    'fileData': json.loads(msg['file_data']) if msg['file_data'] else None,
                    'replyTo': reply_to,
                    'forwardedFrom': forwarded_from,
                    'metadata': json.loads(msg['metadata']) if msg['metadata'] else None,
                    'reactions': json.loads(msg['reactions']) if msg['reactions'] else None,
                    'edited': msg['edited'],
                    'editedAt': msg['edited_at'].isoformat() if msg['edited_at'] else None,
                    'isOwn': msg['user_id'] == 1  # Assume current user is ID 1
                })
            
            # Inverti l'ordine per mostrare i messaggi più vecchi prima
            message_list.reverse()
            
            return jsonify(message_list)
            
    except Exception as e:
        print(f"Error getting channel messages: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/messages/dm/<int:user_id>')
def get_dm_messages(user_id):
    """Get direct messages with a specific user"""
    before_id = request.args.get('before_id')
    limit = int(request.args.get('limit', 50))
    
    try:
        # Trova la conversazione DM
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT c.id FROM chat_schema.conversations c
                JOIN chat_schema.conversation_participants cp1 ON c.id = cp1.conversation_id
                JOIN chat_schema.conversation_participants cp2 ON c.id = cp2.conversation_id
                WHERE c.type = 'direct'
                AND cp1.user_id = 1  -- Utente corrente
                AND cp2.user_id = %s
                """,
                (user_id,)
            )
            result = cursor.fetchone()
            
            if not result:
                return jsonify([])
                
            conversation_id = result['id']
            
            # Costruisci la query per ottenere i messaggi
            query = """
                SELECT m.id, m.conversation_id, m.user_id, m.reply_to_id, 
                       m.text, m.message_type, m.file_data, m.forwarded_from_id,
                       m.metadata, m.reactions, m.edited, m.edited_at, m.created_at,
                       u.username, u.display_name, u.avatar_url, u.status
                FROM chat_schema.messages m
                JOIN chat_schema.users u ON m.user_id = u.id
                WHERE m.conversation_id = %s
            """
            
            params = [conversation_id]
            
            # Aggiungi filtro per paginazione se specificato
            if before_id:
                query += " AND m.id < %s"
                params.append(before_id)
                
            # Ordina e limita
            query += " ORDER BY m.created_at DESC LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, params)
            messages = cursor.fetchall()
            
            # Converti in formato per il frontend
            message_list = []
            for msg in messages:
                # Ottieni i dati dell'utente che ha risposto (se presente)
                reply_user = None
                if msg['reply_to_id']:
                    cursor.execute(
                        """
                        SELECT m.id, m.text, u.id as user_id, u.username, u.display_name, u.avatar_url
                        FROM chat_schema.messages m
                        JOIN chat_schema.users u ON m.user_id = u.id
                        WHERE m.id = %s
                        """,
                        (msg['reply_to_id'],)
                    )
                    reply_result = cursor.fetchone()
                    if reply_result:
                        reply_user = {
                            'id': reply_result['user_id'],
                            'username': reply_result['username'],
                            'displayName': reply_result['display_name'],
                            'avatarUrl': reply_result['avatar_url']
                        }
                
                # Ottieni i dati dell'utente che ha inoltrato (se presente)
                forwarded_user = None
                if msg['forwarded_from_id']:
                    cursor.execute(
                        """
                        SELECT id, username, display_name, avatar_url
                        FROM chat_schema.users
                        WHERE id = %s
                        """,
                        (msg['forwarded_from_id'],)
                    )
                    forward_result = cursor.fetchone()
                    if forward_result:
                        forwarded_user = {
                            'id': forward_result['id'],
                            'username': forward_result['username'],
                            'displayName': forward_result['display_name'],
                            'avatarUrl': forward_result['avatar_url']
                        }
                
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
                    'fileData': json.loads(msg['file_data']) if msg['file_data'] else None,
                    'replyTo': {
                        'id': msg['reply_to_id'],
                        'text': reply_result['text'] if reply_user else None,
                        'user': reply_user
                    } if msg['reply_to_id'] else None,
                    'forwardedFrom': forwarded_user,
                    'metadata': json.loads(msg['metadata']) if msg['metadata'] else None,
                    'reactions': json.loads(msg['reactions']) if msg['reactions'] else None,
                    'edited': msg['edited'],
                    'editedAt': msg['edited_at'].isoformat() if msg['edited_at'] else None,
                    'isOwn': msg['user_id'] == 1  # Assume current user is ID 1
                })
            
            # Inverti l'ordine per mostrare i messaggi più vecchi prima
            message_list.reverse()
            
            return jsonify(message_list)
            
    except Exception as e:
        print(f"Error getting DM messages: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/users')
def get_users():
    """Get all users"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM chat_schema.users ORDER BY display_name")
            users = cursor.fetchall()
        
        user_list = []
        for user in users:
            user_list.append({
                "id": user['id'],
                "username": user['username'],
                "displayName": user['display_name'],
                "avatarUrl": user['avatar_url'],
                "status": user['status']
            })
        
        return jsonify(user_list)
    except Exception as e:
        print(f"Error getting users: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/channels')
def get_channels():
    """Get all channels"""
    try:
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
        
        channel_list = []
        for channel in channels:
            channel_list.append({
                "id": channel['id'],
                "name": channel['name'],
                "description": channel['description'],
                "isPrivate": channel['is_private'],
                "memberCount": channel['member_count']
            })
        
        return jsonify(channel_list)
    except Exception as e:
        print(f"Error getting channels: {str(e)}")
        return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/user/settings', methods=['GET', 'PUT'])
def user_settings():
    """Get or update user settings"""
    user_id = 1  # Assume current user is ID 1
    
    if request.method == 'GET':
        try:
            with get_db_cursor() as cursor:
                cursor.execute(
                    """
                    SELECT * FROM chat_schema.user_settings
                    WHERE user_id = %s
                    """,
                    (user_id,)
                )
                settings = cursor.fetchone()
            
            if not settings:
                # Create default settings if not exist
                with get_db_cursor(commit=True) as cursor:
                    cursor.execute(
                        """
                        INSERT INTO chat_schema.user_settings 
                        (user_id, theme, notification_enabled, sound_enabled, language, timezone)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING *
                        """,
                        (user_id, 'light', True, True, 'en', 'UTC')
                    )
                    settings = cursor.fetchone()
            
            return jsonify({
                "theme": settings['theme'],
                "notificationEnabled": settings['notification_enabled'],
                "soundEnabled": settings['sound_enabled'],
                "language": settings['language'],
                "timezone": settings['timezone'],
                "settingsData": json.loads(settings['settings_data']) if settings['settings_data'] else {}
            })
        except Exception as e:
            print(f"Error getting user settings: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            data = request.json
            
            with get_db_cursor(commit=True) as cursor:
                cursor.execute(
                    """
                    INSERT INTO chat_schema.user_settings 
                    (user_id, theme, notification_enabled, sound_enabled, language, timezone, settings_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                        theme = EXCLUDED.theme,
                        notification_enabled = EXCLUDED.notification_enabled,
                        sound_enabled = EXCLUDED.sound_enabled,
                        language = EXCLUDED.language,
                        timezone = EXCLUDED.timezone,
                        settings_data = EXCLUDED.settings_data
                    RETURNING *
                    """,
                    (
                        user_id, 
                        data.get('theme', 'light'),
                        data.get('notificationEnabled', True),
                        data.get('soundEnabled', True),
                        data.get('language', 'en'),
                        data.get('timezone', 'UTC'),
                        json.dumps(data.get('settingsData', {}))
                    )
                )
                settings = cursor.fetchone()
            
            return jsonify({
                "theme": settings['theme'],
                "notificationEnabled": settings['notification_enabled'],
                "soundEnabled": settings['sound_enabled'],
                "language": settings['language'],
                "timezone": settings['timezone'],
                "settingsData": json.loads(settings['settings_data']) if settings['settings_data'] else {}
            })
        except Exception as e:
            print(f"Error updating user settings: {str(e)}")
            return jsonify({'error': str(e)}), 500

@chat_bp.route('/api/conversations')
def get_conversations():
    """Get all conversations for the current user"""
    try:
        with get_db_cursor() as cursor:
            # Get all conversations (both DMs and channels)
            cursor.execute(
                """
                SELECT c.id, c.name, c.type, c.created_at,
                       CASE 
                           WHEN c.type = 'direct' THEN u.id 
                           ELSE NULL 
                       END as user_id,
                       CASE 
                           WHEN c.type = 'direct' THEN u.username 
                           ELSE c.name 
                       END as display_name,
                       CASE 
                           WHEN c.type = 'direct' THEN u.avatar_url 
                           ELSE NULL 
                       END as avatar_url,
                       CASE 
                           WHEN c.type = 'direct' THEN u.status 
                           ELSE NULL 
                       END as status,
                       (
                           SELECT COUNT(*) 
                           FROM chat_schema.messages m
                           LEFT JOIN chat_schema.message_read_status mrs 
                               ON m.id = mrs.message_id AND mrs.user_id = 1
                           WHERE m.conversation_id = c.id 
                           AND mrs.message_id IS NULL
                           AND m.user_id != 1
                       ) as unread_count,
                       (
                           SELECT m.created_at
                           FROM chat_schema.messages m
                           WHERE m.conversation_id = c.id
                           ORDER BY m.created_at DESC
                           LIMIT 1
                       ) as last_activity
                FROM chat_schema.conversations c
                LEFT JOIN chat_schema.conversation_participants cp ON c.id = cp.conversation_id
                LEFT JOIN chat_schema.users u ON 
                    CASE 
                        WHEN c.type = 'direct' THEN 
                            (SELECT user_id FROM chat_schema.conversation_participants 
                             WHERE conversation_id = c.id AND user_id != 1 LIMIT 1)
                        ELSE NULL
                    END = u.id
                WHERE 
                    (c.type = 'channel') OR
                    (c.type = 'direct' AND EXISTS (
                        SELECT 1 FROM chat_schema.conversation_participants 
                        WHERE conversation_id = c.id AND user_id = 1
                    ))
                GROUP BY c.id, u.id
                ORDER BY last_activity DESC NULLS LAST
                """
            )
            conversations = cursor.fetchall()
        
        conversation_list = []
        for conv in conversations:
            conversation_list.append({
                "id": conv['id'],
                "name": conv['name'],
                "type": conv['type'],
                "userId": conv['user_id'],
                "displayName": conv['display_name'],
                "avatarUrl": conv['avatar_url'],
                "status": conv['status'],
                "unreadCount": conv['unread_count'],
                "lastActivity": conv['last_activity'].isoformat() if conv['last_activity'] else None
            })
        
        return jsonify(conversation_list)
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
        
        with get_db_cursor() as cursor:
            # Search messages
            if search_type in ['all', 'messages']:
                cursor.execute(
                    """
                    SELECT m.id, m.conversation_id, m.text, m.created_at,
                           u.id as user_id, u.username, u.display_name, u.avatar_url,
                           c.type as conversation_type, c.name as conversation_name
                    FROM chat_schema.messages m
                    JOIN chat_schema.users u ON m.user_id = u.id
                    JOIN chat_schema.conversations c ON m.conversation_id = c.id
                    LEFT JOIN chat_schema.conversation_participants cp ON c.id = cp.conversation_id
                    WHERE 
                        m.text ILIKE %s
                        AND (
                            (c.type = 'channel') OR
                            (c.type = 'direct' AND EXISTS (
                                SELECT 1 FROM chat_schema.conversation_participants 
                                WHERE conversation_id = c.id AND user_id = 1
                            ))
                        )
                    GROUP BY m.id, u.id, c.id
                    ORDER BY m.created_at DESC
                    LIMIT 10
                    """,
                    (f"%{query}%",)
                )
                messages = cursor.fetchall()
                
                for msg in messages:
                    results["messages"].append({
                        "id": msg['id'],
                        "conversationId": msg['conversation_id'],
                        "text": msg['text'],
                        "timestamp": msg['created_at'].isoformat(),
                        "user": {
                            "id": msg['user_id'],
                            "username": msg['username'],
                            "displayName": msg['display_name'],
                            "avatarUrl": msg['avatar_url']
                        },
                        "conversationType": msg['conversation_type'],
                        "conversationName": msg['conversation_name']
                    })
            
            # Search users
            if search_type in ['all', 'users']:
                cursor.execute(
                    """
                    SELECT id, username, display_name, avatar_url, status
                    FROM chat_schema.users
                    WHERE username ILIKE %s OR display_name ILIKE %s
                    ORDER BY display_name
                    LIMIT 10
                    """,
                    (f"%{query}%", f"%{query}%")
                )
                users = cursor.fetchall()
                
                for user in users:
                    results["users"].append({
                        "id": user['id'],
                        "username": user['username'],
                        "displayName": user['display_name'],
                        "avatarUrl": user['avatar_url'],
                        "status": user['status']
                    })
            
            # Search channels
            if search_type in ['all', 'channels']:
                cursor.execute(
                    """
                    SELECT c.id, c.name, c.description, c.is_private,
                           COUNT(cm.user_id) as member_count
                    FROM chat_schema.channels c
                    LEFT JOIN chat_schema.channel_members cm ON c.id = cm.channel_id
                    WHERE c.name ILIKE %s OR c.description ILIKE %s
                    GROUP BY c.id
                    ORDER BY c.name
                    LIMIT 10
                    """,
                    (f"%{query}%", f"%{query}%")
                )
                channels = cursor.fetchall()
                
                for channel in channels:
                    results["channels"].append({
                        "id": channel['id'],
                        "name": channel['name'],
                        "description": channel['description'],
                        "isPrivate": channel['is_private'],
                        "memberCount": channel['member_count']
                    })
        
        return jsonify(results)
    except Exception as e:
        print(f"Error searching: {str(e)}")
        return jsonify({'error': str(e)}), 500