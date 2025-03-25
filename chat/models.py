"""
Modelli SQLAlchemy per il modulo chat.
"""
import json
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from chat.database import Base

class User(Base):
    """Modello per gli utenti della chat"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    username = Column(String(100), nullable=False)
    display_name = Column(String(255))
    avatar_url = Column(Text)
    status = Column(String(50), default="offline")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relazioni
    messages = relationship("Message", back_populates="user")
    
    def to_dict(self):
        """Converte l'oggetto in dizionario"""
        return {
            "id": self.id,
            "username": self.username,
            "displayName": self.display_name,
            "avatarUrl": self.avatar_url,
            "status": self.status
        }

class Conversation(Base):
    """Modello per le conversazioni (dirette o canali)"""
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    type = Column(String(50), nullable=False)  # 'direct', 'channel', etc.
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relazioni
    messages = relationship("Message", back_populates="conversation")
    participants = relationship("ConversationParticipant", back_populates="conversation")
    
    def to_dict(self):
        """Converte l'oggetto in dizionario"""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }

class ConversationParticipant(Base):
    """Modello per i partecipanti alle conversazioni"""
    __tablename__ = "conversation_participants"
    
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at = Column(DateTime, server_default=func.now())
    
    # Relazioni
    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")

class Message(Base):
    """Modello per i messaggi della chat"""
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    reply_to_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"))
    text = Column(Text)
    message_type = Column(String(50), default="normal")
    file_data = Column(JSON)
    forwarded_from_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"))
    metadata = Column(JSON)
    edited = Column(Boolean, default=False)
    edited_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relazioni
    conversation = relationship("Conversation", back_populates="messages")
    user = relationship("User", back_populates="messages")
    reply_to = relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])
    forwarded_from = relationship("Message", remote_side=[id], foreign_keys=[forwarded_from_id])
    
    def to_dict(self):
        """Converte l'oggetto in dizionario"""
        user_dict = None
        if self.user:
            user_dict = self.user.to_dict()
            
        # Gestisce il reply_to
        reply_to_dict = None
        if self.reply_to:
            reply_to_dict = {
                "id": self.reply_to.id,
                "text": self.reply_to.text,
                "message_type": self.reply_to.message_type,
                "fileData": self.reply_to.file_data,
                "user": self.reply_to.user.to_dict() if self.reply_to.user else None
            }
            
        # Gestisce il forwarded_from
        forwarded_from_dict = None
        if self.forwarded_from:
            forwarded_from_dict = {
                "id": self.forwarded_from.id,
                "user": self.forwarded_from.user.to_dict() if self.forwarded_from.user else None
            }
        
        return {
            "id": self.id,
            "conversationId": self.conversation_id,
            "user": user_dict,
            "text": self.text,
            "timestamp": self.created_at.isoformat() if self.created_at else None,
            "type": self.message_type,
            "fileData": self.file_data,
            "replyTo": reply_to_dict,
            "forwardedFrom": forwarded_from_dict,
            "metadata": self.metadata or {},
            "edited": self.edited,
            "editedAt": self.edited_at.isoformat() if self.edited_at else None,
            "isOwn": False  # Deve essere impostato dal chiamante
        }

class Channel(Base):
    """Modello per i canali"""
    __tablename__ = "channels"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    is_private = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relazioni
    members = relationship("ChannelMember", back_populates="channel")
    
    def to_dict(self):
        """Converte l'oggetto in dizionario"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "isPrivate": self.is_private,
            "memberCount": len(self.members) if self.members else 0
        }

class ChannelMember(Base):
    """Modello per i membri dei canali"""
    __tablename__ = "channel_members"
    
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(50), default="member")
    joined_at = Column(DateTime, server_default=func.now())
    
    # Relazioni
    channel = relationship("Channel", back_populates="members")
    user = relationship("User")

class MessageReadStatus(Base):
    """Modello per tracciare lo stato di lettura dei messaggi"""
    __tablename__ = "message_read_status"
    
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    read_at = Column(DateTime, server_default=func.now())
    
    # Vincolo di unicità
    __table_args__ = (
        # Garantisce che un messaggio sia marcato come letto solo una volta per utente
        # Utilizza `UniqueConstraint` invece del __table_args__ se necessario
        {"sqlite_autoincrement": True},
    )

class UserSetting(Base):
    """Modello per le impostazioni degli utenti"""
    __tablename__ = "user_settings"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    theme = Column(String(50), default="light")
    notification_enabled = Column(Boolean, default=True)
    sound_enabled = Column(Boolean, default=True)
    language = Column(String(10), default="en")
    timezone = Column(String(50), default="UTC")
    settings_data = Column(JSON)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relazioni
    user = relationship("User")
    
    def to_dict(self):
        """Converte l'oggetto in dizionario"""
        return {
            "theme": self.theme,
            "notificationEnabled": self.notification_enabled,
            "soundEnabled": self.sound_enabled,
            "language": self.language,
            "timezone": self.timezone,
            "settingsData": self.settings_data or {}
        }