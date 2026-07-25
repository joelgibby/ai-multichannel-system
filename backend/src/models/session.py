"""
Session model for authentication and user sessions
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..config.database import Base
from ..schemas.base import BaseSchema


class Session(Base):
    """Session database model for authentication"""
    
    __tablename__ = "sessions"
    
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        unique=True,
    )
    
    # Session data
    session_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    access_token: Mapped[str] = mapped_column(String(500), nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Device info
    device_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    device_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Location
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(default=True)
    is_revoked: Mapped[bool] = mapped_column(default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Foreign Keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    
    # Relationships (commented out to avoid circular import issues)
    # user: Mapped["User"] = relationship("User", back_populates="sessions")


class SessionBase(BaseSchema):
    """Base session schema"""
    device_type: Optional[str] = None
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None


class SessionCreate(SessionBase):
    """Schema for creating a session"""
    user_id: uuid.UUID
    session_key: str
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None


class SessionInDB(SessionBase):
    """Session schema with ID and timestamps"""
    id: uuid.UUID
    session_key: str
    access_token: str
    refresh_token: Optional[str] = None
    is_active: bool = True
    is_revoked: bool = False
    user_id: uuid.UUID
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        populate_by_name = True
