"""
Message model and schemas
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..config.database import Base, pg_enum
from ..schemas.base import BaseSchema


class MessageRole(str, Enum):
    """Message roles in conversation"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageType(str, Enum):
    """Types of messages"""
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    COMMAND = "command"


class MessageStatus(str, Enum):
    """Message processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Message(Base):
    """Message database model"""
    
    __tablename__ = "messages"
    
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        unique=True,
    )
    
    # Content
    role: Mapped[MessageRole] = mapped_column(
        pg_enum(MessageRole, "messagerole"),
        nullable=False,
        index=True,
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_type: Mapped[MessageType] = mapped_column(
        pg_enum(MessageType, "messagetype"),
        default=MessageType.TEXT,
    )
    
    # Metadata
    status: Mapped[MessageStatus] = mapped_column(
        pg_enum(MessageStatus, "messagestatus"),
        default=MessageStatus.COMPLETED,
        index=True,
    )
    message_metadata: Mapped[dict] = mapped_column(
        JSON,
        default={},
        nullable=False,
    )
    
    # AI Response
    ai_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tokens_used: Mapped[Optional[int]] = mapped_column(nullable=True)
    latency_ms: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    # External references
    external_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    file_id: Mapped[Optional[uuid.UUID]] = mapped_column(nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
    # Foreign Keys
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    file_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("file_storage.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    
    # Relationships (commented out to avoid circular import issues)
    # conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    # user: Mapped[Optional["User"]] = relationship("User", back_populates="messages")
    # file: Mapped[Optional["FileStorage"]] = relationship("FileStorage", back_populates="message")


class MessageBase(BaseSchema):
    """Base message schema"""
    role: MessageRole
    content: Optional[str] = None
    message_type: MessageType = MessageType.TEXT
    message_metadata: dict = {}
    external_id: Optional[str] = None


class MessageCreate(MessageBase):
    """Schema for creating a message"""
    conversation_id: Optional[uuid.UUID] = None
    ai_model: Optional[str] = None


class MessageUpdate(BaseSchema):
    """Schema for updating a message"""
    content: Optional[str] = None
    status: Optional[MessageStatus] = None
    message_metadata: Optional[dict] = None


class MessageInDB(MessageBase):
    """Message schema with ID and timestamps"""
    id: uuid.UUID
    status: MessageStatus = MessageStatus.COMPLETED
    ai_model: Optional[str] = None
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    conversation_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    file_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True
