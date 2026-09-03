"""
Conversation Service for managing conversations across all channels
"""
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from ..config.database import database
from ..config.settings import get_settings
from ..models.conversation import ChannelType, Conversation, ConversationStatus
from ..models.file_storage import FileStorage
from ..models.message import Message, MessageRole, MessageStatus, MessageType
from ..models.user import User
from ..services.ai_service import AIService, ChatMessage, get_ai_service
from ..services.s3_service import get_s3_service
from ..services.sms_service import IncomingSMS, get_sms_service, truncate_sms_body
from ..services.socket_service import SocketService, get_socket_service
from ..services.voice_service import VoiceCall, VoiceService, get_voice_service

DEFAULT_SMS_REPLY = "I received your message."


def ai_response_text(
    ai_response: Any,
    default: str = DEFAULT_SMS_REPLY,
) -> str:
    """Read reply text from a ChatResponse, dict, or missing value."""
    if ai_response is None:
        return default
    content = getattr(ai_response, "content", None)
    if content:
        return str(content)
    if isinstance(ai_response, dict):
        content = ai_response.get("content")
        if content:
            return str(content)
    return default


class ConversationService:
    """Service for managing conversations across all channels"""
    
    def __init__(self):
        self.settings = get_settings()
        self._db = database.async_session  # This is the async_sessionmaker
        self._ai_service = get_ai_service
        self._s3_service = get_s3_service
        self._sms_service = get_sms_service
        self._voice_service = get_voice_service
        self._socket_service = get_socket_service
    
    async def create_conversation(
        self,
        conversation_data: dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
    ) -> Conversation:
        """
        Create a new conversation
        
        Args:
            conversation_data: Conversation data (dict or Pydantic model)
            user_id: Optional user ID
            
        Returns:
            Created conversation
        """
        # Convert Pydantic model to dict if needed
        logger.info(f"Raw conversation_data type: {type(conversation_data)}")
        if hasattr(conversation_data, 'model_dump'):
            logger.info(f"Calling model_dump(mode='json')...")
            conversation_data = conversation_data.model_dump(mode='json')
            logger.info(f"After model_dump: {conversation_data}")
        elif hasattr(conversation_data, 'dict'):
            conversation_data = conversation_data.dict()
        
        logger.info(f"Creating conversation with data: {conversation_data}")
        logger.info(f"Channel value: {conversation_data.get('channel')}, type: {type(conversation_data.get('channel'))}")
        try:
            async with self._db() as session:
                conversation = Conversation(
                    **conversation_data,
                    user_id=user_id,
                )
                session.add(conversation)
                await session.commit()
                await session.refresh(conversation)
                logger.info(f"Created conversation: {conversation.id}")
                return conversation
        except Exception as e:
            logger.error(f"Database error creating conversation: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    async def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """
        Get a conversation by ID
        
        Args:
            conversation_id: Conversation ID
            
        Returns:
            Conversation or None
        """
        async with self._db() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            return result.scalar_one_or_none()
    
    async def update_conversation(
        self,
        conversation_id: str,
        update_data: dict[str, Any],
    ) -> Optional[Conversation]:
        """
        Update a conversation
        
        Args:
            conversation_id: Conversation ID
            update_data: Data to update
            
        Returns:
            Updated conversation or None
        """
        async with self._db() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                for key, value in update_data.items():
                    setattr(conversation, key, value)
                await session.commit()
                await session.refresh(conversation)
            
            return conversation
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """
        Delete a conversation
        
        Args:
            conversation_id: Conversation ID
            
        Returns:
            Whether deletion was successful
        """
        async with self._db() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                await session.delete(conversation)
                await session.commit()
                return True
            return False
    
    async def list_conversations(
        self,
        user_id: Optional[uuid.UUID] = None,
        channel: Optional[ChannelType] = None,
        status: Optional[ConversationStatus] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Conversation]:
        """
        List conversations with optional filters
        
        Args:
            user_id: Filter by user ID
            channel: Filter by channel type
            status: Filter by status
            limit: Maximum number to return
            offset: Offset for pagination
            
        Returns:
            List of conversations
        """
        async with self._db() as session:
            query = select(Conversation)
            
            if user_id:
                query = query.where(Conversation.user_id == user_id)
            if channel:
                query = query.where(Conversation.channel == channel)
            if status:
                query = query.where(Conversation.status == status)
            
            query = query.order_by(Conversation.updated_at.desc())
            query = query.limit(limit).offset(offset)
            
            result = await session.execute(query)
            return result.scalars().all()
    
    async def add_message(
        self,
        conversation_id: str,
        message_data: dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
    ) -> Message:
        """
        Add a message to a conversation
        
        Args:
            conversation_id: Conversation ID
            message_data: Message data
            user_id: Optional user ID
            
        Returns:
            Created message
        """
        if hasattr(message_data, "model_dump"):
            message_data = message_data.model_dump(exclude_none=True)
        elif hasattr(message_data, "dict"):
            message_data = message_data.dict(exclude_none=True)
        message_data.pop("conversation_id", None)

        async with self._db() as session:
            message = Message(
                **message_data,
                conversation_id=conversation_id,
                user_id=user_id,
            )
            session.add(message)
            await session.commit()
            await session.refresh(message)
            
            # Update conversation timestamp
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                conversation.updated_at = datetime.utcnow()
                await session.commit()
            
            # Broadcast the new message via Socket.IO
            try:
                socket_service = self._socket_service()
                await socket_service.broadcast_message(
                    str(conversation_id),
                    {
                        "id": str(message.id),
                        "role": message.role,
                        "content": message.content,
                        "message_type": message.message_type,
                        "status": message.status,
                        "created_at": message.created_at.isoformat(),
                        "user_id": str(message.user_id) if message.user_id else None,
                    }
                )
            except Exception as e:
                # Log but don't fail if Socket.IO is not available
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to broadcast message via Socket.IO: {e}")
            
            return message
    
    async def get_messages(
        self,
        conversation_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Message]:
        """
        Get messages from a conversation
        
        Args:
            conversation_id: Conversation ID
            limit: Maximum number to return
            offset: Offset for pagination
            
        Returns:
            List of messages
        """
        async with self._db() as session:
            result = await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            return result.scalars().all()
    
    async def process_message(
        self,
        conversation_id: str,
        message_data: dict[str, Any],
        *,
        existing_user_message: Optional[Message] = None,
    ) -> dict[str, Any]:
        """
        Process a message (generate AI response)
        
        Args:
            conversation_id: Conversation ID
            message_data: Message data
            existing_user_message: Already-stored user message (avoids a duplicate insert)
            
        Returns:
            Dictionary with processing results
        """
        # Get conversation
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            raise ValueError("Conversation not found")
        
        if existing_user_message is not None:
            user_message = existing_user_message
        else:
            user_message = await self.add_message(conversation_id, {
                **message_data,
                "role": MessageRole.USER,
                "status": MessageStatus.COMPLETED,
            })
        
        # Get conversation history for context
        messages = await self.get_messages(conversation_id, limit=20)
        
        # Convert to ChatMessage format for AI
        chat_messages = [
            ChatMessage(role=msg.role, content=msg.content or "")
            for msg in reversed(messages)  # Reverse to get chronological order
            if msg.content
        ]
        
        # Generate AI response
        ai_service = self._ai_service()
        ai_response = await ai_service.chat(
            messages=chat_messages,
            model=conversation.ai_model,
            temperature=conversation.temperature,
            max_tokens=conversation.max_tokens,
        )
        
        # Add AI response as message
        assistant_message = await self.add_message(conversation_id, {
            "role": MessageRole.ASSISTANT,
            "content": ai_response.content,
            "status": MessageStatus.COMPLETED,
            "ai_model": ai_response.model,
            "tokens_used": ai_response.usage.get("total_tokens"),
            "latency_ms": ai_response.latency_ms,
            "message_metadata": {
                "finish_reason": ai_response.finish_reason,
            },
        })
        
        return {
            "user_message": user_message,
            "assistant_message": assistant_message,
            "ai_response": ai_response,
        }
    
    async def process_sms(self, incoming_sms: IncomingSMS) -> dict[str, Any]:
        """
        Process an incoming SMS message.

        Stores the inbound text once, generates an AI reply, and returns
        text for the webhook to send as TwiML (no REST send, to avoid a
        duplicate outbound message).
        """
        conversation = await self._get_or_create_sms_conversation(
            phone_number=incoming_sms.from_
        )

        user_message = await self.add_message(conversation.id, {
            "role": MessageRole.USER,
            "content": incoming_sms.body,
            "message_type": MessageType.TEXT,
            "status": MessageStatus.COMPLETED,
            "external_id": incoming_sms.message_sid,
            "message_metadata": {
                "from": incoming_sms.from_,
                "to": incoming_sms.to,
                "media_urls": incoming_sms.media_urls,
            },
        })

        result = await self.process_message(
            conversation.id,
            {
                "role": MessageRole.USER,
                "content": incoming_sms.body,
            },
            existing_user_message=user_message,
        )

        assistant_message = result.get("assistant_message")
        response_text = truncate_sms_body(
            ai_response_text(result.get("ai_response"))
        )

        return {
            "conversation_id": str(conversation.id),
            "user_message_id": str(user_message.id),
            "assistant_message_id": (
                str(assistant_message.id) if assistant_message is not None else None
            ),
            "response_text": response_text,
        }
    
    async def process_voice_call(
        self,
        call: VoiceCall,
        request_data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Process an incoming voice call
        
        Args:
            call: Voice call information
            request_data: Full request data from Twilio
            
        Returns:
            Dictionary with processing results
        """
        voice_service = self._voice_service()
        
        # Find or create conversation for this call
        conversation = await self._get_or_create_voice_conversation(
            call_sid=call.call_sid,
            from_=call.from_,
            to=call.to,
        )
        
        # Check if this is a new call or a callback
        if "SpeechResult" in request_data:
            # This is a speech recognition result
            speech_result = request_data.get("SpeechResult", "")
            confidence = request_data.get("Confidence", None)
            
            # Add the speech as a message
            user_message = await self.add_message(conversation.id, {
                "role": MessageRole.USER,
                "content": speech_result,
                "message_type": MessageType.AUDIO,
                "external_id": call.call_sid,
                "message_metadata": {
                    "confidence": confidence,
                    "call_sid": call.call_sid,
                },
            })
            
            # Process the message
            result = await self.process_message(conversation.id, {
                "role": MessageRole.USER,
                "content": speech_result,
            })
            
            response_text = ai_response_text(result.get("ai_response"))
            twiml = voice_service.generate_twiml_voice_response(response_text)
            
            return {
                "conversation_id": str(conversation.id),
                "user_message_id": str(user_message.id),
                "response_text": response_text,
                "twiml": twiml,
            }
        
        elif "RecordingUrl" in request_data:
            # This is a recording
            recording_url = request_data.get("RecordingUrl")
            
            # Process the recording
            voice_result = await voice_service.process_voice_input(
                audio_url=recording_url,
                conversation_id=str(conversation.id),
            )
            
            # Add the transcription as a message
            user_message = await self.add_message(conversation.id, {
                "role": MessageRole.USER,
                "content": voice_result.get("text", ""),
                "message_type": MessageType.AUDIO,
                "external_id": call.call_sid,
                "message_metadata": {
                    "confidence": voice_result.get("confidence"),
                    "duration_seconds": voice_result.get("duration_seconds"),
                    "recording_url": recording_url,
                },
            })
            
            # Process the message
            result = await self.process_message(conversation.id, {
                "role": MessageRole.USER,
                "content": voice_result.get("text", ""),
            })
            
            response_text = ai_response_text(result.get("ai_response"))
            twiml = voice_service.generate_twiml_voice_response(response_text)
            
            return {
                "conversation_id": str(conversation.id),
                "user_message_id": str(user_message.id),
                "response_text": response_text,
                "twiml": twiml,
            }
        
        else:
            # Initial call - generate greeting
            twiml = voice_service.generate_twiml_voice_response(
                "Hello! How can I help you today?"
            )
            return {
                "conversation_id": str(conversation.id),
                "twiml": twiml,
            }
    
    async def _get_or_create_sms_conversation(
        self,
        phone_number: str,
    ) -> Conversation:
        """
        Get or create a conversation for SMS
        
        Args:
            phone_number: Phone number
            
        Returns:
            Conversation
        """
        async with self._db() as session:
            # Try to find existing conversation
            result = await session.execute(
                select(Conversation)
                .where(Conversation.external_id == phone_number)
                .where(Conversation.channel == ChannelType.SMS)
                .order_by(Conversation.updated_at.desc())
                .limit(1)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                return conversation
            
            # Create new conversation
            conversation = Conversation(
                title=f"SMS with {phone_number}",
                channel=ChannelType.SMS,
                external_id=phone_number,
            )
            session.add(conversation)
            await session.commit()
            await session.refresh(conversation)
            return conversation
    
    async def _get_or_create_voice_conversation(
        self,
        call_sid: str,
        from_: str,
        to: str,
    ) -> Conversation:
        """
        Get or create a conversation for voice call
        
        Args:
            call_sid: Call SID
            from_: Caller phone number
            to: Callee phone number
            
        Returns:
            Conversation
        """
        async with self._db() as session:
            # Try to find existing conversation for this call
            result = await session.execute(
                select(Conversation)
                .where(Conversation.external_id == call_sid)
                .where(Conversation.channel == ChannelType.VOICE)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                return conversation
            
            # Create new conversation
            conversation = Conversation(
                title=f"Voice call with {from_}",
                channel=ChannelType.VOICE,
                external_id=call_sid,
                conversation_metadata={
                    "from": from_,
                    "to": to,
                },
            )
            session.add(conversation)
            await session.commit()
            await session.refresh(conversation)
            return conversation
    
    async def upload_file_to_conversation(
        self,
        conversation_id: str,
        file_data: bytes,
        filename: str,
        user_id: Optional[uuid.UUID] = None,
    ) -> FileStorage:
        """
        Upload a file to a conversation
        
        Args:
            conversation_id: Conversation ID
            file_data: File content as bytes
            filename: Original filename
            user_id: Optional user ID
            
        Returns:
            FileStorage entry
        """
        s3_service = await self._s3_service()

        upload_result = await s3_service.upload_bytes(
            content=file_data,
            original_filename=filename,
        )

        async with self._db() as session:
            file_storage = FileStorage(
                original_filename=filename,
                stored_filename=upload_result.original_filename,
                file_type=s3_service.get_file_type_from_extension(filename),
                mime_type=None,
                file_size_bytes=len(file_data),
                provider=upload_result.provider,
                storage_path=upload_result.key,
                cid=upload_result.key if len(upload_result.key) <= 100 else None,
                url=upload_result.url,
                user_id=user_id,
                conversation_id=conversation_id,
            )
            session.add(file_storage)
            await session.commit()
            await session.refresh(file_storage)
            return file_storage


# Singleton instance
_conversation_service: Optional[ConversationService] = None


def get_conversation_service() -> ConversationService:
    """Get the conversation service singleton"""
    global _conversation_service
    if _conversation_service is None:
        _conversation_service = ConversationService()
    return _conversation_service
