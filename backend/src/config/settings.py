"""
Application settings using Pydantic Settings Management
"""
from functools import lru_cache
from typing import Optional, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Application
    APP_NAME: str = "AI Multichannel System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: Union[list[str], str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]
    
    # Database (PostgreSQL)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://user:password@localhost:5432/ai_multichannel",
        validation_alias="DATABASE_URL"
    )
    
    # Redis (for caching and Celery)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # OpenRouter AI
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    DEFAULT_AI_MODEL: str = "mistralai/mistral-7b-instruct"
    
    # Object Storage (S3-compatible)
    S3_BUCKET: Optional[str] = None
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_ENDPOINT_URL: Optional[str] = None
    S3_PUBLIC_URL_BASE: Optional[str] = None
    S3_PREFIX: str = "uploads"
    LOCAL_STORAGE_PATH: str = "/tmp/ai-multichannel-storage"
    PUBLIC_API_BASE_URL: str = "http://localhost:8000"
    
    # Twilio (SMS & Voice)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    
    # ElevenLabs (TTS)
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
    
    # AssemblyAI (STT - Alternative)
    ASSEMBLYAI_API_KEY: Optional[str] = None
    
    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_FILE_TYPES: str = ".mp3,.wav,.ogg,.png,.jpg,.jpeg,.pdf,.txt"
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Ensure async SQLAlchemy uses asyncpg (Fly sets postgres:// URLs)."""
        if not isinstance(v, str):
            return v
        if "+asyncpg" in v.split("://", 1)[0]:
            return v
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v.removeprefix("postgres://")
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v.removeprefix("postgresql://")
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from comma-separated string or list"""
        if isinstance(v, list):
            return v
        if v == "*":
            return ["*"]
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list"""
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [self.CORS_ORIGINS]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in testing"""
        return self.ENVIRONMENT.lower() == "testing"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Convenience function to get settings
settings = get_settings()
