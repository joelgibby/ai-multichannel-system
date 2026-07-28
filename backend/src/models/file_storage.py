"""
File storage model for object storage backends
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..config.database import Base
from ..schemas.base import BaseSchema


class StorageProvider(str, Enum):
    """Storage providers"""
    S3 = "s3"
    LOCAL = "local"


class FileType(str, Enum):
    """File types"""
    AUDIO = "audio"
    IMAGE = "image"
    VIDEO = "video"
    DOCUMENT = "document"
    TEXT = "text"
    OTHER = "other"


class FileStorage(Base):
    """File storage database model"""
    
    __tablename__ = "file_storage"
    
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        unique=True,
    )
    
    # File metadata
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[FileType] = mapped_column(
        SQLEnum(FileType),
        default=FileType.OTHER,
        index=True,
    )
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(nullable=False)
    
    # Storage info
    provider: Mapped[StorageProvider] = mapped_column(
        SQLEnum(StorageProvider),
        default=StorageProvider.S3,
        index=True,
    )
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    cid: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )  # Legacy content identifier; mirrors storage_path for S3 keys
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Security
    is_public: Mapped[bool] = mapped_column(default=False)
    access_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
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
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    
    # Relationships (commented out to avoid circular import issues)
    # user: Mapped[Optional["User"]] = relationship("User", back_populates="files")
    # conversation: Mapped[Optional["Conversation"]] = relationship("Conversation", back_populates="files")
    # message: Mapped[Optional["Message"]] = relationship("Message", back_populates="file")


class FileStorageBase(BaseSchema):
    """Base file storage schema"""
    original_filename: str
    stored_filename: str
    file_type: FileType = FileType.OTHER
    mime_type: Optional[str] = None
    file_size_bytes: int
    provider: StorageProvider = StorageProvider.S3
    storage_path: str
    cid: Optional[str] = None
    url: Optional[str] = None
    is_public: bool = False


class FileStorageCreate(FileStorageBase):
    """Schema for creating a file storage entry"""
    pass


class FileStorageInDB(FileStorageBase):
    """File storage schema with ID and timestamps"""
    id: uuid.UUID
    access_token: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    conversation_id: Optional[uuid.UUID] = None
    message_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True
