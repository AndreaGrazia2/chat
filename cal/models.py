import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint, Text, Time
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.sql import func

from .database import Base

class TimestampMixin:
    """Mixin per aggiungere campi created_at e updated_at"""
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class Category(Base):
    """Modello per le categorie di eventi"""
    __tablename__ = "categories"
    
    id = Column(String(20), primary_key=True)
    name = Column(String(50), nullable=False)
    color = Column(String(7), nullable=False)
    icon = Column(String(50))
    description = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relazione con gli eventi
    events = relationship("Event", back_populates="category")
    
    def __repr__(self):
        return f"<Category {self.id}: {self.name}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "icon": self.icon,
            "description": self.description
        }

class User(Base):
    """Modello per gli utenti"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(50))
    last_name = Column(String(50))
    avatar_url = Column(String(255))
    theme = Column(String(20), default="light")
    preferred_view = Column(String(20), default="month")
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relazioni
    events = relationship("Event", back_populates="user")
    preferences = relationship("UserPreference", back_populates="user", uselist=False)
    
    def __repr__(self):
        return f"<User {self.username}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "id": str(self.id),
            "username": self.username,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "avatar_url": self.avatar_url,
            "theme": self.theme,
            "preferred_view": self.preferred_view,
            "is_active": self.is_active
        }

class Event(Base, TimestampMixin):
    """Modello per gli eventi del calendario"""
    __tablename__ = "events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    start_date = Column(TIMESTAMP(timezone=True), nullable=False)
    end_date = Column(TIMESTAMP(timezone=True), nullable=False)
    category_id = Column(String(20), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    all_day = Column(Boolean, default=False)
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(Text)
    location = Column(String(255))
    url = Column(String(255))
    is_public = Column(Boolean, default=False)
    color = Column(String(7))
    
    # Relazioni
    user = relationship("User", back_populates="events")
    category = relationship("Category", back_populates="events")
    attendees = relationship("EventAttendee", back_populates="event")
    tags = relationship("Tag", secondary="event_tags", back_populates="events")
    reminders = relationship("Reminder", back_populates="event")
    
    # Constraint per validare che end_date sia successiva a start_date
    __table_args__ = (
        CheckConstraint('end_date >= start_date', name='event_date_check'),
    )
    
    def __repr__(self):
        return f"<Event {self.title}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "description": self.description,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "category_id": self.category_id,
            "category": self.category.to_dict() if self.category else None,
            "all_day": self.all_day,
            "is_recurring": self.is_recurring,
            "recurrence_rule": self.recurrence_rule,
            "location": self.location,
            "url": self.url,
            "is_public": self.is_public,
            "color": self.color,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class EventAttendee(Base, TimestampMixin):
    """Modello per gli invitati agli eventi"""
    __tablename__ = "event_attendees"
    
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status = Column(String(20), default="pending")
    response_date = Column(TIMESTAMP(timezone=True))
    
    # Relazioni
    event = relationship("Event", back_populates="attendees")
    user = relationship("User")
    
    def __repr__(self):
        return f"<EventAttendee {self.event_id}:{self.user_id}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "event_id": str(self.event_id),
            "user_id": str(self.user_id),
            "status": self.status,
            "response_date": self.response_date.isoformat() if self.response_date else None
        }

class Tag(Base, TimestampMixin):
    """Modello per i tag degli eventi"""
    __tablename__ = "tags"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False)
    color = Column(String(7))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    
    # Relazioni
    events = relationship("Event", secondary="event_tags", back_populates="tags")
    user = relationship("User")
    
    def __repr__(self):
        return f"<Tag {self.name}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "id": str(self.id),
            "name": self.name,
            "color": self.color,
            "user_id": str(self.user_id) if self.user_id else None
        }

class EventTag(Base):
    """Tabella di associazione tra eventi e tag"""
    __tablename__ = "event_tags"
    
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

class Reminder(Base, TimestampMixin):
    """Modello per i promemoria degli eventi"""
    __tablename__ = "reminders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reminder_time = Column(TIMESTAMP(timezone=True), nullable=False)
    minutes_before = Column(Integer, nullable=False)
    notification_type = Column(String(20), default="email")
    is_sent = Column(Boolean, default=False)
    
    # Relazioni
    event = relationship("Event", back_populates="reminders")
    user = relationship("User")
    
    def __repr__(self):
        return f"<Reminder {self.event_id}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "id": str(self.id),
            "event_id": str(self.event_id),
            "user_id": str(self.user_id),
            "reminder_time": self.reminder_time.isoformat() if self.reminder_time else None,
            "minutes_before": self.minutes_before,
            "notification_type": self.notification_type,
            "is_sent": self.is_sent
        }

class UserPreference(Base):
    """Modello per le preferenze degli utenti"""
    __tablename__ = "user_preferences"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    first_day_of_week = Column(Integer, default=1)  # 0=Domenica, 1=Lunedì, etc.
    default_view = Column(String(20), default="month")
    working_hours_start = Column(Time, default="09:00:00")
    working_hours_end = Column(Time, default="17:00:00")
    show_weekends = Column(Boolean, default=True)
    time_format = Column(String(10), default="24h")  # 12h o 24h
    date_format = Column(String(20), default="DD/MM/YYYY")
    default_event_duration = Column(Integer, default=60)  # in minuti
    default_reminder = Column(Integer, default=30)  # in minuti
    language = Column(String(10), default="it")
    timezone = Column(String(50), default="Europe/Rome")
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relazioni
    user = relationship("User", back_populates="preferences")
    
    def __repr__(self):
        return f"<UserPreference {self.user_id}>"
    
    def to_dict(self):
        """Converte il modello in un dizionario"""
        return {
            "user_id": str(self.user_id),
            "first_day_of_week": self.first_day_of_week,
            "default_view": self.default_view,
            "working_hours_start": str(self.working_hours_start),
            "working_hours_end": str(self.working_hours_end),
            "show_weekends": self.show_weekends,
            "time_format": self.time_format,
            "date_format": self.date_format,
            "default_event_duration": self.default_event_duration,
            "default_reminder": self.default_reminder,
            "language": self.language,
            "timezone": self.timezone
        }