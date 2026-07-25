"""
Authentication Service for user authentication and authorization
"""
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select

from ..config.database import get_db
from ..config.settings import get_settings
from ..models.session import Session, SessionCreate
from ..models.user import User, UserCreate, UserInDB


class Token(BaseModel):
    """JWT Token structure"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    """Token payload data"""
    user_id: Optional[uuid.UUID] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    session_id: Optional[uuid.UUID] = None


class AuthService:
    """Service for user authentication and authorization"""
    
    def __init__(self):
        self.settings = get_settings()
        self._db = get_db
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against its hash
        
        Args:
            plain_password: Plain text password
            hashed_password: Hashed password
            
        Returns:
            Whether the password is correct
        """
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """
        Hash a password
        
        Args:
            password: Plain text password
            
        Returns:
            Hashed password
        """
        return self.pwd_context.hash(password)
    
    def create_access_token(
        self,
        data: dict[str, Any],
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """
        Create a JWT access token
        
        Args:
            data: Token payload data
            expires_delta: Token expiration time
            
        Returns:
            JWT token string
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=self.settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            self.settings.SECRET_KEY,
            algorithm=self.settings.ALGORITHM,
        )
        return encoded_jwt
    
    def create_refresh_token(self) -> str:
        """
        Create a refresh token
        
        Returns:
            Refresh token string
        """
        return secrets.token_urlsafe(64)
    
    def decode_token(self, token: str) -> TokenData:
        """
        Decode and validate a JWT token
        
        Args:
            token: JWT token string
            
        Returns:
            Token payload data
            
        Raises:
            JWTError: If token is invalid
        """
        try:
            payload = jwt.decode(
                token,
                self.settings.SECRET_KEY,
                algorithms=[self.settings.ALGORITHM],
            )
            return TokenData(**payload)
        except JWTError as e:
            raise JWTError(f"Invalid token: {e}")
    
    async def authenticate_user(
        self,
        email: Optional[str] = None,
        phone_number: Optional[str] = None,
        password: Optional[str] = None,
    ) -> Optional[User]:
        """
        Authenticate a user
        
        Args:
            email: User email
            phone_number: User phone number
            password: User password
            
        Returns:
            User if authentication succeeds, None otherwise
        """
        async with self._db() as session:
            query = select(User)
            
            if email:
                query = query.where(User.email == email)
            elif phone_number:
                query = query.where(User.phone_number == phone_number)
            else:
                return None
            
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            
            if user and password and user.hashed_password:
                if self.verify_password(password, user.hashed_password):
                    return user
            
            return None
    
    async def create_user(self, user_data: UserCreate) -> UserInDB:
        """
        Create a new user
        
        Args:
            user_data: User creation data
            
        Returns:
            Created user
        """
        async with self._db() as session:
            # Check if user already exists
            if user_data.email:
                result = await session.execute(
                    select(User).where(User.email == user_data.email)
                )
                if result.scalar_one_or_none():
                    raise ValueError("User with this email already exists")
            
            if user_data.phone_number:
                result = await session.execute(
                    select(User).where(User.phone_number == user_data.phone_number)
                )
                if result.scalar_one_or_none():
                    raise ValueError("User with this phone number already exists")
            
            # Create user
            user_dict = user_data.model_dump()
            if "password" in user_dict:
                user_dict["hashed_password"] = self.get_password_hash(user_dict.pop("password"))
            
            user = User(**user_dict)
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
            return UserInDB.model_validate(user, from_attributes=True)
    
    async def create_session(
        self,
        user: User,
        device_info: Optional[dict[str, Any]] = None,
    ) -> Token:
        """
        Create a new session for a user
        
        Args:
            user: User to create session for
            device_info: Optional device information
            
        Returns:
            Authentication token
        """
        # Generate tokens
        access_token_expires = timedelta(
            minutes=self.settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        access_token = self.create_access_token(
            data={
                "user_id": str(user.id),
                "email": user.email,
                "phone_number": user.phone_number,
            },
            expires_delta=access_token_expires,
        )
        
        refresh_token = self.create_refresh_token()
        session_key = secrets.token_urlsafe(32)
        
        # Create session in database
        async with self._db() as session:
            session_data = SessionCreate(
                user_id=user.id,
                session_key=session_key,
                access_token=access_token,
                refresh_token=refresh_token,
                device_type=device_info.get("device_type") if device_info else None,
                device_id=device_info.get("device_id") if device_info else None,
                ip_address=device_info.get("ip_address") if device_info else None,
                user_agent=device_info.get("user_agent") if device_info else None,
                country=device_info.get("country") if device_info else None,
                city=device_info.get("city") if device_info else None,
                expires_at=datetime.utcnow() + access_token_expires,
            )
            
            db_session = Session(**session_data.model_dump())
            session.add(db_session)
            await session.commit()
            await session.refresh(db_session)
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=int(access_token_expires.total_seconds()),
            refresh_token=refresh_token,
        )
    
    async def get_session(self, session_key: str) -> Optional[Session]:
        """
        Get a session by its key
        
        Args:
            session_key: Session key
            
        Returns:
            Session or None
        """
        async with self._db() as session:
            result = await session.execute(
                select(Session).where(Session.session_key == session_key)
            )
            return result.scalar_one_or_none()
    
    async def get_session_by_token(self, access_token: str) -> Optional[Session]:
        """
        Get a session by its access token
        
        Args:
            access_token: Access token
            
        Returns:
            Session or None
        """
        async with self._db() as session:
            result = await session.execute(
                select(Session).where(Session.access_token == access_token)
            )
            return result.scalar_one_or_none()
    
    async def validate_session(self, access_token: str) -> Optional[User]:
        """
        Validate a session and return the user
        
        Args:
            access_token: Access token
            
        Returns:
            User if session is valid, None otherwise
        """
        try:
            # Decode token
            token_data = self.decode_token(access_token)
            
            if not token_data.user_id:
                return None
            
            # Get user
            async with self._db() as session:
                result = await session.execute(
                    select(User).where(User.id == token_data.user_id)
                )
                user = result.scalar_one_or_none()
                
                if not user or not user.is_active:
                    return None
                
                # Check if session exists and is valid
                session_result = await session.execute(
                    select(Session)
                    .where(Session.user_id == user.id)
                    .where(Session.access_token == access_token)
                    .where(Session.is_active == True)
                    .where(Session.is_revoked == False)
                )
                session_obj = session_result.scalar_one_or_none()
                
                if not session_obj:
                    return None
                
                # Update last used time
                session_obj.last_used_at = datetime.utcnow()
                await session.commit()
                
                return user
        except JWTError:
            return None
    
    async def refresh_session(self, refresh_token: str) -> Optional[Token]:
        """
        Refresh a session using a refresh token
        
        Args:
            refresh_token: Refresh token
            
        Returns:
            New token if refresh succeeds, None otherwise
        """
        async with self._db() as session:
            result = await session.execute(
                select(Session).where(Session.refresh_token == refresh_token)
            )
            session_obj = result.scalar_one_or_none()
            
            if not session_obj or not session_obj.is_active or session_obj.is_revoked:
                return None
            
            # Get user
            user_result = await session.execute(
                select(User).where(User.id == session_obj.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if not user or not user.is_active:
                return None
            
            # Create new tokens
            access_token_expires = timedelta(
                minutes=self.settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
            access_token = self.create_access_token(
                data={
                    "user_id": str(user.id),
                    "email": user.email,
                    "phone_number": user.phone_number,
                },
                expires_delta=access_token_expires,
            )
            
            refresh_token_new = self.create_refresh_token()
            
            # Update session
            session_obj.access_token = access_token
            session_obj.refresh_token = refresh_token_new
            session_obj.expires_at = datetime.utcnow() + access_token_expires
            await session.commit()
            
            return Token(
                access_token=access_token,
                token_type="bearer",
                expires_in=int(access_token_expires.total_seconds()),
                refresh_token=refresh_token_new,
            )
    
    async def revoke_session(self, session_key: str) -> bool:
        """
        Revoke a session
        
        Args:
            session_key: Session key
            
        Returns:
            Whether revocation was successful
        """
        async with self._db() as session:
            result = await session.execute(
                select(Session).where(Session.session_key == session_key)
            )
            session_obj = result.scalar_one_or_none()
            
            if session_obj:
                session_obj.is_revoked = True
                session_obj.is_active = False
                await session.commit()
                return True
            return False
    
    async def revoke_all_sessions(self, user_id: uuid.UUID) -> int:
        """
        Revoke all sessions for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Number of sessions revoked
        """
        async with self._db() as session:
            result = await session.execute(
                select(Session).where(Session.user_id == user_id)
            )
            sessions = result.scalars().all()
            
            for session_obj in sessions:
                session_obj.is_revoked = True
                session_obj.is_active = False
            
            await session.commit()
            return len(sessions)


# Singleton instance
_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Get the auth service singleton"""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service
