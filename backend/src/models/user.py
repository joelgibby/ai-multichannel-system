"""
User model and schemas
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, Field
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..config.database import Base
from ..schemas.base import BaseModel, BaseSchema


class User(Base):
    """User database model"""
    
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        unique=True,
    )
    
    # Authentication
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )
    phone_number: Mapped[Optional[str]] = mapped_column(
        String(20),
        unique=True,
        nullable=True,
        index=True,
    )
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    
    # Profile
    full_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Preferences
    default_ai_model: Mapped[str] = mapped_column(
        String(100),
        default="mistralai/mistral-7b-instruct",
    )
    preferred_voice_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
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
    
    # Relationships (commented out to avoid circular import issues)
    # conversations: Mapped[list["Conversation"]] = relationship(
    #     "Conversation",
    #     back_populates="user",
    #     cascade="all, delete-orphan",
    # )
    # messages: Mapped[list["Message"]] = relationship(
    #     "Message",
    #     back_populates="user",
    #     cascade="all, delete-orphan",
    # )
    # sessions: Mapped[list["Session"]] = relationship(
    #     "Session",
    #     back_populates="user",
    #     cascade="all, delete-orphan",
    # )
    # files: Mapped[list["FileStorage"]] = relationship(
    #     "FileStorage",
    #     back_populates="user",
    #     cascade="all, delete-orphan",
    # )


class UserBase(BaseSchema):
    """Base user schema"""
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(None, max_length=20)
    full_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    default_ai_model: str = "mistralai/mistral-7b-instruct"
    preferred_voice_id: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a user"""
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class UserUpdate(BaseSchema):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(None, max_length=20)
    full_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    default_ai_model: Optional[str] = None
    preferred_voice_id: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)


class UserInDB(UserBase):
    """User schema with ID and timestamps"""
    id: uuid.UUID
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True
