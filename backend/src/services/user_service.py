"""
User Service for managing user accounts and authentication
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config.database import get_db
from ..models.user import User, UserCreate, UserUpdate

logger = logging.getLogger(__name__)


class UserService:
    """Service for managing users"""
    
    def __init__(self):
        self._db = get_db
    
    async def create_user(self, user_data: UserCreate) -> User:
        """Create a new user"""
        async with self._db() as session:
            user = User(
                email=user_data.email,
                phone_number=user_data.phone_number,
                full_name=user_data.full_name,
                avatar_url=user_data.avatar_url,
                default_ai_model=user_data.default_ai_model or "mistralai/mistral-7b-instruct",
                preferred_voice_id=user_data.preferred_voice_id,
            )
            
            if user_data.password:
                # In a real implementation, we would hash the password here
                user.hashed_password = f"hashed_{user_data.password}"
            
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user
    
    async def get_user(self, user_id: uuid.UUID) -> Optional[User]:
        """Get a user by ID"""
        async with self._db() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email"""
        async with self._db() as session:
            result = await session.execute(
                select(User).where(User.email == email)
            )
            return result.scalar_one_or_none()
    
    async def get_user_by_phone(self, phone_number: str) -> Optional[User]:
        """Get a user by phone number"""
        async with self._db() as session:
            result = await session.execute(
                select(User).where(User.phone_number == phone_number)
            )
            return result.scalar_one_or_none()
    
    async def update_user(self, user_id: uuid.UUID, update_data: UserUpdate) -> Optional[User]:
        """Update a user"""
        async with self._db() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if user:
                for key, value in update_data.model_dump(exclude_unset=True).items():
                    if value is not None:
                        setattr(user, key, value)
                await session.commit()
                await session.refresh(user)
            
            return user
    
    async def delete_user(self, user_id: uuid.UUID) -> bool:
        """Delete a user"""
        async with self._db() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if user:
                await session.delete(user)
                await session.commit()
                return True
            return False
    
    async def list_users(self, limit: int = 100, offset: int = 0) -> list[User]:
        """List all users"""
        async with self._db() as session:
            result = await session.execute(
                select(User)
                .order_by(User.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return result.scalars().all()


# Singleton instance
_user_service: Optional[UserService] = None


def get_user_service() -> UserService:
    """Get the user service singleton"""
    global _user_service
    if _user_service is None:
        _user_service = UserService()
    return _user_service
