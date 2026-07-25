"""
Conversation model and schemas
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..config.database import Base
from ..schemas.base import BaseSchema


class ChannelType(str, Enum):
    """Types of communication channels"""
    WEB = "web"
    SMS = "sms"
    VOICE = "voice"
    MOBILE = "mobile"
    EMAIL = "email"


class ConversationStatus(str, Enum):
    """Conversation status"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class Conversation(Base):
    """Conversation database model"""
    
    __tablename__ = "conversations"
    
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        unique=True,
    )
    
    # Metadata
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    channel: Mapped[str] = mapped_column(
        String(20),
        default="web",
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        index=True,
    )
    
    # AI Configuration
    ai_model: Mapped[str] = mapped_column(
        String(100),
        default="mistralai/mistral-7b-instruct",
    )
    temperature: Mapped[float] = mapped_column(default=0.7)
    max_tokens: Mapped[int] = mapped_column(default=4096)
    
    # Context
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_window: Mapped[list] = mapped_column(
        JSON,
        default=[],
        nullable=False  # Store conversation history for context
    )
    
    # External IDs (for SMS, Voice, etc.)
    external_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    
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
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    
    # Relationships (commented out to avoid circular import issues)
    # user: Mapped[Optional["User"]] = relationship("User", back_populates="conversations")
    # messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="desc(Message.created_at)")
    # files: Mapped[list["FileStorage"]] = relationship("FileStorage", back_populates="conversation", cascade="all, delete-orphan")


class ConversationBase(BaseSchema):
    """Base conversation schema"""
    title: Optional[str] = None
    channel: ChannelType = ChannelType.WEB
    ai_model: str = "mistralai/mistral-7b-instruct"
    temperature: float = 0.7
    max_tokens: int = 4096
    system_prompt: Optional[str] = None
    external_id: Optional[str] = None


class ConversationCreate(ConversationBase):
    """Schema for creating a conversation"""
    pass


class ConversationUpdate(BaseSchema):
    """Schema for updating a conversation"""
    title: Optional[str] = None
    status: Optional[ConversationStatus] = None
    ai_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    system_prompt: Optional[str] = None


class ConversationInDB(ConversationBase):
    """Conversation schema with ID and timestamps"""
    id: uuid.UUID
    status: ConversationStatus = ConversationStatus.ACTIVE
    created_at: datetime
    updated_at: datetime
    user_id: Optional[uuid.UUID] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True
