"""
SMS Service for sending and receiving SMS messages via Twilio
"""
import re
from typing import Any, Optional

from pydantic import BaseModel, Field
from twilio.request_validator import RequestValidator
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

from ..config.settings import get_settings
from ..models.conversation import ChannelType
from ..models.message import MessageRole, MessageType


class SMSMessage(BaseModel):
    """SMS message structure"""
    body: str = Field(..., min_length=1, max_length=1600)
    to: str = Field(..., description="Recipient phone number in E.164 format")
    from_: Optional[str] = Field(None, description="Sender phone number")
    media_urls: list[str] = Field(default_factory=list, description="Media URLs to include")


class SMSResponse(BaseModel):
    """SMS response structure"""
    sid: str
    status: str
    to: str
    from_: str
    body: str
    num_media: int = 0


SMS_BODY_MAX_LENGTH = 1600


class IncomingSMS(BaseModel):
    """Incoming SMS structure from Twilio"""
    message_sid: str
    from_: str
    to: str
    body: str
    num_media: int = 0
    media_urls: list[str] = Field(default_factory=list)
    profile_name: Optional[str] = None


def form_field(request_data: dict[str, Any], *names: str, default: str = "") -> str:
    """Read a Twilio/form field by exact or case-insensitive name."""
    lowered = {str(key).lower(): value for key, value in request_data.items()}
    for name in names:
        value = request_data.get(name, lowered.get(name.lower()))
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def validate_twilio_signature(
    auth_token: str,
    url: str,
    params: dict[str, Any],
    signature: str,
) -> bool:
    """Return True if the Twilio request signature matches the payload."""
    if not auth_token or not signature or not url:
        return False
    return RequestValidator(auth_token).validate(url, params, signature)


def truncate_sms_body(body: str, max_length: int = SMS_BODY_MAX_LENGTH) -> str:
    """Trim an SMS body to Twilio's character limit."""
    if len(body) <= max_length:
        return body
    if max_length <= 1:
        return body[:max_length]
    return body[: max_length - 1] + "…"


class SMSService:
    """Service for sending and receiving SMS messages via Twilio"""
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[Client] = None
    
    @property
    def client(self) -> Client:
        """Get or create Twilio client"""
        if self._client is None:
            if not self.settings.TWILIO_ACCOUNT_SID or not self.settings.TWILIO_AUTH_TOKEN:
                raise ValueError("Twilio credentials not configured")
            self._client = Client(
                self.settings.TWILIO_ACCOUNT_SID,
                self.settings.TWILIO_AUTH_TOKEN,
            )
        return self._client
    
    def validate_phone_number(self, phone_number: str) -> str:
        """
        Validate and format phone number to E.164 format
        
        Args:
            phone_number: Phone number to validate
            
        Returns:
            Formatted phone number in E.164 format
            
        Raises:
            ValueError: If phone number is invalid
        """
        # Remove all non-digit characters
        digits = re.sub(r"[^\d]", "", phone_number)
        
        # Basic validation
        if len(digits) < 10:
            raise ValueError(f"Invalid phone number: {phone_number}")
        
        # If it's a US number (10 digits), add +1 prefix
        if len(digits) == 10:
            return f"+1{digits}"
        
        # If it already has a + prefix, return as-is
        if phone_number.startswith("+"):
            return phone_number
        
        # Otherwise, assume it's in E.164 format
        return f"+{digits}"
    
    def send_sms(
        self,
        to: str,
        body: str,
        media_urls: Optional[list[str]] = None,
        from_: Optional[str] = None,
    ) -> SMSResponse:
        """
        Send an SMS message
        
        Args:
            to: Recipient phone number
            body: Message body (max 1600 characters)
            media_urls: Optional list of media URLs to include (MMS)
            from_: Optional sender phone number (defaults to configured number)
            
        Returns:
            SMSResponse with message details
            
        Raises:
            ValueError: If phone number is invalid or message is too long
        """
        # Validate phone numbers
        to = self.validate_phone_number(to)
        from_ = from_ or self.settings.TWILIO_PHONE_NUMBER
        
        if from_:
            from_ = self.validate_phone_number(from_)
        
        # Validate message length
        if len(body) > 1600:
            raise ValueError("Message body exceeds 1600 character limit")
        
        # Send the message
        message = self.client.messages.create(
            body=body,
            from_=from_,
            to=to,
            media_urls=media_urls or [],
        )
        
        return SMSResponse(
            sid=message.sid,
            status=message.status,
            to=message.to,
            from_=message.from_,
            body=message.body,
            num_media=len(message.media_urls) if hasattr(message, "media_urls") else 0,
        )
    
    def send_mms(
        self,
        to: str,
        body: str,
        media_urls: list[str],
        from_: Optional[str] = None,
    ) -> SMSResponse:
        """
        Send an MMS (rich SMS) with media attachments
        
        Args:
            to: Recipient phone number
            body: Message body
            media_urls: List of publicly accessible media URLs
            from_: Optional sender phone number
            
        Returns:
            SMSResponse with message details
        """
        return self.send_sms(
            to=to,
            body=body,
            media_urls=media_urls,
            from_=from_,
        )
    
    def generate_twiml_response(
        self,
        response_body: str,
        media_urls: Optional[list[str]] = None,
    ) -> str:
        """
        Generate TwiML response for incoming SMS
        
        Args:
            response_body: Response message body
            media_urls: Optional media URLs to include
            
        Returns:
            TwiML XML string
        """
        response = MessagingResponse()
        body = truncate_sms_body(response_body or "")
        if body:
            response.message(body)

        if media_urls:
            for url in media_urls:
                response.message().media(url)

        return str(response)
    
    def parse_incoming_sms(self, request_data: dict[str, Any]) -> IncomingSMS:
        """
        Parse incoming SMS from Twilio webhook request
        
        Args:
            request_data: Dictionary of request parameters
            
        Returns:
            IncomingSMS object
        """
        media_urls = []
        num_media = int(form_field(request_data, "NumMedia", "num_media", default="0") or 0)

        if num_media > 0:
            for i in range(num_media):
                media_url = form_field(request_data, f"MediaUrl{i}", f"mediaurl{i}")
                if media_url:
                    media_urls.append(media_url)

        return IncomingSMS(
            message_sid=form_field(request_data, "MessageSid", "SmsSid", "message_sid"),
            from_=form_field(request_data, "From", "from"),
            to=form_field(request_data, "To", "to"),
            body=form_field(request_data, "Body", "body", "text"),
            num_media=num_media,
            media_urls=media_urls,
            profile_name=form_field(request_data, "ProfileName", "profile_name") or None,
        )
    
    async def process_incoming_sms(
        self,
        incoming_sms: IncomingSMS,
        conversation_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Process an incoming SMS message
        
        This is a placeholder for the actual processing logic
        which would involve:
        1. Creating/updating a conversation
        2. Storing the message
        3. Generating a response using AI
        4. Sending the response back
        
        Args:
            incoming_sms: Incoming SMS message
            conversation_id: Optional existing conversation ID
            
        Returns:
            Dictionary with processing results
        """
        # This would be implemented in the conversation service
        # For now, just return the parsed SMS
        return {
            "type": "sms",
            "channel": ChannelType.SMS,
            "from": incoming_sms.from_,
            "to": incoming_sms.to,
            "body": incoming_sms.body,
            "media_urls": incoming_sms.media_urls,
            "conversation_id": conversation_id,
        }
    
    def get_message_history(
        self,
        from_: Optional[str] = None,
        to: Optional[str] = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Get SMS message history
        
        Args:
            from_: Filter by sender
            to: Filter by recipient
            limit: Maximum number of messages to return
            
        Returns:
            List of message history
        """
        messages = self.client.messages.list(
            from_=from_,
            to=to,
            limit=limit,
        )
        
        return [
            {
                "sid": msg.sid,
                "from": msg.from_,
                "to": msg.to,
                "body": msg.body,
                "status": msg.status,
                "date_sent": msg.date_sent.isoformat() if msg.date_sent else None,
                "num_media": len(msg.media_urls) if hasattr(msg, "media_urls") else 0,
            }
            for msg in messages
        ]
    
    def get_phone_number_info(self, phone_number: str) -> dict[str, Any]:
        """
        Get information about a phone number
        
        Args:
            phone_number: Phone number to look up
            
        Returns:
            Phone number information
        """
        try:
            number = self.client.lookups.phone_numbers(phone_number).fetch()
            return {
                "phone_number": number.phone_number,
                "country_code": number.country_code,
                "country": number.country,
                "carrier": getattr(number.carrier, "name", None),
                "type": getattr(number.carrier, "type", None),
            }
        except Exception:
            return {"phone_number": phone_number, "error": "Not found"}
    
    async def close(self) -> None:
        """Close the Twilio client"""
        if self._client:
            await self._client.close()
            self._client = None


# Singleton instance
_sms_service: Optional[SMSService] = None


def get_sms_service() -> SMSService:
    """Get the SMS service singleton"""
    global _sms_service
    if _sms_service is None:
        _sms_service = SMSService()
    return _sms_service
