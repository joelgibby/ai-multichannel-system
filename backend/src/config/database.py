"""
Database configuration and session management
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .settings import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


class DatabaseConfig:
    """Database configuration and session factory"""
    
    def __init__(self):
        self.settings = get_settings()
        self.engine = create_async_engine(
            self.settings.DATABASE_URL,
            echo=self.settings.DEBUG,
            future=True,
        )
        self.async_session = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Dependency to get database session"""
        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def close(self) -> None:
        """Close database connections"""
        await self.engine.dispose()


# Create database config instance
database = DatabaseConfig()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session (for FastAPI)"""
    async with database.async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
