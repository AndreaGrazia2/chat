import json
from datetime import datetime
# Change this line:
# from ..workflow.db.connection import get_db_cursor

# To an absolute import:
from workflow.db.connection import get_db_cursor

class User:
    """Model representing a chat user"""
    
    def __init__(self, id=None, username=None, display_name=None, 
                 avatar_url=None, status='offline', created_at=None, updated_at=None):
        self.id = id
        self.username = username
        self.display_name = display_name
        self.avatar_url = avatar_url
        self.status = status
        self.created_at = created_at
        self.updated_at = updated_at
    
    @classmethod
    def get_by_id(cls, user_id):
        """Get user by ID"""
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM chat_schema.users
                WHERE id = %s
                """,
                (user_id,)
            )
            result = cursor.fetchone()
        
        if not result:
            return None
            
        return cls(
            id=result['id'],
            username=result['username'],
            display_name=result['display_name'],
            avatar_url=result['avatar_url'],
            status=result['status'],
            created_at=result['created_at'],
            updated_at=result['updated_at']
        )
    
    @classmethod
    def from_db_record(cls, record):
        """Create a User instance from a DB record"""
        return cls(
            id=record['id'],
            username=record['username'],
            display_name=record['display_name'],
            avatar_url=record['avatar_url'],
            status=record['status'],
            created_at=record['created_at'],
            updated_at=record['updated_at']
        )
    
    def save(self):
        """Save the user to the database"""
        with get_db_cursor(commit=True) as cursor:
            if self.id:
                # Update
                cursor.execute(
                    """
                    UPDATE chat_schema.users
                    SET username = %s, display_name = %s, avatar_url = %s, status = %s
                    WHERE id = %s
                    RETURNING id
                    """,
                    (self.username, self.display_name, self.avatar_url, self.status, self.id)
                )
            else:
                # Insert
                cursor.execute(
                    """
                    INSERT INTO chat_schema.users (username, display_name, avatar_url, status)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                    """,
                    (self.username, self.display_name, self.avatar_url, self.status)
                )
            
            result = cursor.fetchone()
            if result:
                self.id = result['id']
            return self.id
    
    def to_dict(self):
        """Convert user to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "username": self.username,
            "displayName": self.display_name,
            "avatarUrl": self.avatar_url,
            "status": self.status
        }

class Conversation:
    """Model representing a conversation (direct message or channel)"""
    
    def __init__(self, id=None, name=None, type="direct", 
                 created_at=None, updated_at=None):
        self.id = id
        self.name = name
        self.type = type  # 'direct' or 'channel'
        self.created_at = created_at
        self.updated_at = updated_at
    
    @classmethod
    def from_db_record(cls, record):
        """Create a Conversation instance from a database record"""
        return cls(
            id=record['id'],
            name=record['name'],
            type=record['type'],
            created_at=record['created_at'],
            updated_at=record['updated_at']
        )
    
    @classmethod
    def get_by_id(cls, conversation_id):
        """Retrieve a conversation by ID"""
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT * FROM chat_schema.conversations WHERE id = %s",
                (conversation_id,)
            )
            result = cursor.fetchone()
            
            if result:
                return cls.from_db_record(result)
            return None
    
    def save(self):
        """Save the conversation to the database"""
        with get_db_cursor(commit=True) as cursor:
            if self.id:
                # Update
                cursor.execute(
                    """
                    UPDATE chat_schema.conversations
                    SET name = %s, type = %s
                    WHERE id = %s
                    RETURNING id
                    """,
                    (self.name, self.type, self.id)
                )
            else:
                # Insert
                cursor.execute(
                    """
                    INSERT INTO chat_schema.conversations (name, type)
                    VALUES (%s, %s)
                    RETURNING id
                    """,
                    (self.name, self.type)
                )
            
            result = cursor.fetchone()
            if result:
                self.id = result['id']
            return self.id
    
    def get_messages(self, limit=50, before_id=None):
        """Get messages for this conversation"""
        with get_db_cursor() as cursor:
            if before_id:
                cursor.execute(
                    """
                    SELECT m.*, u.username, u.display_name, u.avatar_url, u.status
                    FROM chat_schema.messages m
                    JOIN chat_schema.users u ON m.user_id = u.id
                    WHERE m.conversation_id = %s AND m.id < %s
                    ORDER BY m.created_at DESC
                    LIMIT %s
                    """,
                    (self.id, before_id, limit)
                )
            else:
                cursor.execute(
                    """
                    SELECT m.*, u.username, u.display_name, u.avatar_url, u.status
                    FROM chat_schema.messages m
                    JOIN chat_schema.users u ON m.user_id = u.id
                    WHERE m.conversation_id = %s
                    ORDER BY m.created_at DESC
                    LIMIT %s
                    """,
                    (self.id, limit)
                )
            
            results = cursor.fetchall()
            
            # Convert to Message objects
            messages = []
            for record in results:
                user = User(
                    id=record['user_id'],
                    username=record['username'],
                    display_name=record['display_name'],
                    avatar_url=record['avatar_url'],
                    status=record['status']
                )
                
                message = Message(
                    id=record['id'],
                    conversation_id=record['conversation_id'],
                    user=user,
                    text=record['text'],
                    message_type=record['message_type'],
                    file_data=record['file_data'],
                    created_at=record['created_at']
                )
                
                messages.append(message)
            
            return messages

class Message:
    """Model representing a chat message"""
    
    def __init__(self, id=None, conversation_id=None, user=None, user_id=None,
                 reply_to_id=None, text=None, message_type="normal", 
                 file_data=None, forwarded_from_id=None, created_at=None):
        self.id = id
        self.conversation_id = conversation_id
        self.user = user
        self.user_id = user_id or (user.id if user else None)
        self.reply_to_id = reply_to_id
        self.text = text
        self.message_type = message_type
        self.file_data = file_data
        self.forwarded_from_id = forwarded_from_id
        self.created_at = created_at or datetime.now()
    
    @classmethod
    def get_by_id(cls, message_id):
        """Retrieve a message by ID"""
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT m.*, u.id as user_id, u.username, u.display_name, u.avatar_url, u.status
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.id = %s
                """,
                (message_id,)
            )
            result = cursor.fetchone()
            
            if not result:
                return None
            
            # Create user object
            user = User(
                id=result['user_id'],
                username=result['username'],
                display_name=result['display_name'],
                avatar_url=result['avatar_url'],
                status=result['status']
            )
            
            # Create message object
            message = cls(
                id=result['id'],
                conversation_id=result['conversation_id'],
                user=user,
                reply_to_id=result['reply_to_id'],
                text=result['text'],
                message_type=result['message_type'],
                file_data=result['file_data'],
                forwarded_from_id=result['forwarded_from_id'],
                created_at=result['created_at']
            )
            
            return message
    
    def save(self):
        """Save message to database"""
        with get_db_cursor(commit=True) as cursor:
            if self.id is None:
                # Insert new message
                cursor.execute(
                    """
                    INSERT INTO chat_schema.messages 
                    (conversation_id, user_id, reply_to_id, text, message_type, file_data, forwarded_from_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                    """,
                    (
                        self.conversation_id,
                        self.user.id if self.user else None,
                        self.reply_to_id,
                        self.text,
                        self.message_type,
                        json.dumps(self.file_data) if self.file_data else None,
                        self.forwarded_from_id
                    )
                )
                result = cursor.fetchone()
                self.id = result['id']
                self.created_at = result['created_at']
            else:
                # Update existing message
                cursor.execute(
                    """
                    UPDATE chat_schema.messages
                    SET text = %s, message_type = %s, file_data = %s
                    WHERE id = %s
                    """,
                    (
                        self.text,
                        self.message_type,
                        json.dumps(self.file_data) if self.file_data else None,
                        self.id
                    )
                )
        return self
    
    def to_dict(self):
        """Convert message to dictionary for JSON response"""
        user_dict = None
        if self.user:
            user_dict = {
                "id": self.user.id,
                "username": self.user.username,
                "displayName": self.user.display_name,
                "avatarUrl": self.user.avatar_url,
                "status": self.user.status
            }
        
        return {
            "id": self.id,
            "user": user_dict,
            "text": self.text,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
            "type": self.message_type,
            "fileData": self.file_data,
            "replyTo": self.reply_to_id,  # This should be expanded to include the full message
            "forwardedFrom": self.forwarded_from_id  # This should be expanded to include the user
        }


def generate_demo_data():
    """Generate and save demo data to the database"""
    from datetime import datetime, timedelta
    import random
    import json
    
    # Dati complessi per i messaggi demo
    complex_messages = [
        {
            "text": "Check out this image!",
            "type": "image",
            "file_data": {
                "url": "/static/img/demo/image1.jpg",
                "name": "demo_image.jpg",
                "size": 1024000,
                "type": "image/jpeg"
            }
        },
        {
            "text": "Here's a document I mentioned",
            "type": "file",
            "file_data": {
                "url": "/static/files/demo/document.pdf",
                "name": "project_plan.pdf",
                "size": 2048000,
                "type": "application/pdf"
            }
        },
        {
            "text": "```python\ndef hello_world():\n    print('Hello, world!')\n```",
            "type": "code",
            "metadata": {
                "language": "python"
            }
        },
        {
            "text": "https://example.com/interesting-article",
            "type": "link",
            "metadata": {
                "title": "Interesting Article About Technology",
                "description": "This article discusses the latest trends in technology.",
                "image": "/static/img/demo/link_preview.jpg"
            }
        },
        {
            "text": "I'm forwarding this message from Alex",
            "type": "forwarded",
            "forwarded_from_id": 5
        }
    ]
    
    # Messaggi normali
    normal_messages = [
        "Hello everyone!",
        "How's it going?",
        "I'm working on a new project.",
        "Has anyone tried the new framework?",
        "Just checking in.",
        "What's the status on the design?",
        "I'll be out of office tomorrow.",
        "Can someone help me with this issue?",
        "Great work on the presentation!",
        "Let's discuss this in our next meeting."
    ]
    
    # Messaggi con risposte
    reply_messages = [
        "I agree with your point.",
        "That's a good idea!",
        "I'm not sure about that.",
        "Let me check and get back to you.",
        "Thanks for the information!"
    ]
    
    try:
        with get_db_cursor(commit=True) as cursor:
            # Non cancelliamo i dati esistenti, aggiungiamo solo nuovi messaggi complessi
            
            # Ottieni tutti gli utenti e le conversazioni esistenti
            cursor.execute("SELECT id FROM chat_schema.users")
            user_ids = [row['id'] for row in cursor.fetchall()]
            
            cursor.execute("SELECT id, type FROM chat_schema.conversations")
            conversations = cursor.fetchall()
            
            # Genera messaggi complessi per ogni conversazione
            for conversation in conversations:
                conversation_id = conversation['id']
                conversation_type = conversation['type']
                
                # Ottieni l'ultimo messaggio per determinare la data di partenza
                cursor.execute(
                    """
                    SELECT created_at FROM chat_schema.messages 
                    WHERE conversation_id = %s 
                    ORDER BY created_at DESC LIMIT 1
                    """, 
                    (conversation_id,)
                )
                result = cursor.fetchone()
                
                if result:
                    base_time = result['created_at'] + timedelta(minutes=5)
                else:
                    base_time = datetime.now() - timedelta(days=7)
                
                # Genera 20 messaggi complessi per conversazione
                for i in range(20):
                    # Scegli un utente casuale appropriato per il tipo di conversazione
                    if conversation_type == 'direct':
                        # Per DM, ottieni i partecipanti
                        cursor.execute(
                            """
                            SELECT user_id FROM chat_schema.conversation_participants
                            WHERE conversation_id = %s
                            """,
                            (conversation_id,)
                        )
                        participants = [row['user_id'] for row in cursor.fetchall()]
                        user_id = random.choice(participants)
                    else:
                        # Per canali, scegli un utente casuale
                        user_id = random.choice(user_ids)
                    
                    # Decidi se questo messaggio è una risposta
                    is_reply = random.random() < 0.3  # 30% di probabilità
                    reply_to_id = None
                    
                    if is_reply:
                        # Trova un messaggio precedente a cui rispondere
                        cursor.execute(
                            """
                            SELECT id FROM chat_schema.messages
                            WHERE conversation_id = %s
                            ORDER BY created_at DESC
                            LIMIT 10
                            """,
                            (conversation_id,)
                        )
                        previous_messages = cursor.fetchall()
                        if previous_messages:
                            reply_to_id = random.choice(previous_messages)['id']
                            message_data = {
                                "text": random.choice(reply_messages),
                                "type": "normal"
                            }
                        else:
                            message_data = {
                                "text": random.choice(normal_messages),
                                "type": "normal"
                            }
                    else:
                        # Decidi se questo è un messaggio complesso o normale
                        is_complex = random.random() < 0.4  # 40% di probabilità
                        
                        if is_complex:
                            message_data = random.choice(complex_messages)
                        else:
                            message_data = {
                                "text": random.choice(normal_messages),
                                "type": "normal"
                            }
                    
                    # Calcola il timestamp
                    message_time = base_time + timedelta(minutes=i*15)
                    
                    # Inserisci il messaggio
                    cursor.execute(
                        """
                        INSERT INTO chat_schema.messages 
                        (conversation_id, user_id, reply_to_id, text, message_type, file_data, forwarded_from_id, metadata, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            conversation_id,
                            user_id,
                            reply_to_id,
                            message_data.get("text"),
                            message_data.get("type", "normal"),
                            json.dumps(message_data.get("file_data")) if message_data.get("file_data") else None,
                            message_data.get("forwarded_from_id"),
                            json.dumps(message_data.get("metadata")) if message_data.get("metadata") else None,
                            message_time
                        )
                    )
            
            return {
                "users": len(user_ids),
                "conversations": len(conversations),
                "messages_per_conversation": 20,
                "total_messages": len(conversations) * 20
            }
    
    except Exception as e:
        print(f"Error generating demo data: {str(e)}")
        raise