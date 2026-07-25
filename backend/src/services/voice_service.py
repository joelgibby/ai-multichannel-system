"""
Voice Service for handling voice calls and speech processing
"""
import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, AsyncGenerator, Optional, Union

import aiohttp
from pydantic import BaseModel, Field
from twilio.twiml.voice_response import VoiceResponse

from ..config.settings import get_settings
from ..models.conversation import ChannelType
from ..models.message import MessageRole, MessageType


class VoiceCall(BaseModel):
    """Voice call structure"""
    call_sid: str
    from_: str
    to: str
    status: str
    direction: str  # incoming or outgoing


class VoiceRequest(BaseModel):
    """Voice request structure"""
    text: str = Field(..., description="Text to convert to speech")
    voice_id: Optional[str] = Field(None, description="Voice ID for TTS")
    language: Optional[str] = Field(None, description="Language code")
    speed: Optional[float] = Field(1.0, description="Speech speed (0.5-2.0)")


class VoiceResponse(BaseModel):
    """Voice response structure"""
    audio_url: Optional[str] = None
    audio_bytes: Optional[bytes] = None
    duration_seconds: Optional[float] = None


class STTRequest(BaseModel):
    """Speech-to-Text request structure"""
    audio_url: Optional[str] = Field(None, description="URL to audio file")
    audio_bytes: Optional[bytes] = Field(None, description="Audio file bytes")
    language: Optional[str] = Field(None, description="Language code")
    model: Optional[str] = Field(None, description="STT model to use")


class STTResponse(BaseModel):
    """Speech-to-Text response structure"""
    text: str
    confidence: Optional[float] = None
    language: Optional[str] = None
    duration_seconds: Optional[float] = None


class VoiceService:
    """Service for handling voice calls, TTS, and STT"""
    
    def __init__(self):
        self.settings = get_settings()
    
    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = None,
        speed: float = 1.0,
    ) -> VoiceResponse:
        """
        Convert text to speech using ElevenLabs
        
        Args:
            text: Text to convert
            voice_id: Voice ID (defaults to settings.ELEVENLABS_VOICE_ID)
            language: Language code
            speed: Speech speed (0.5-2.0)
            
        Returns:
            VoiceResponse with audio URL or bytes
        """
        if not self.settings.ELEVENLABS_API_KEY:
            raise ValueError("ELEVENLABS_API_KEY not configured")
        
        voice_id = voice_id or self.settings.ELEVENLABS_VOICE_ID
        
        # ElevenLabs API endpoint
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "xi-api-key": self.settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        }
        
        data = {
            "text": text,
            "model_id": "eleven_multilingual_v2",  # or "eleven_monolingual_v1"
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }
        
        # Add language if specified
        if language:
            data["voice_settings"]["language"] = language
        
        # Add speed if not default
        if speed != 1.0:
            data["voice_settings"]["speed"] = speed
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise ValueError(f"TTS failed: {response.status} - {text}")
                
                audio_bytes = await response.read()
                
                # Save to temp file to get duration (optional)
                duration = None
                
                return VoiceResponse(
                    audio_bytes=audio_bytes,
                    duration_seconds=duration,
                )
    
    async def text_to_speech_stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: Optional[str] = None,
        speed: float = 1.0,
    ) -> AsyncGenerator[bytes, None]:
        """
        Convert text to speech and stream the audio
        
        Args:
            text: Text to convert
            voice_id: Voice ID
            language: Language code
            speed: Speech speed
            
        Yields:
            Audio chunks as bytes
        """
        if not self.settings.ELEVENLABS_API_KEY:
            raise ValueError("ELEVENLABS_API_KEY not configured")
        
        voice_id = voice_id or self.settings.ELEVENLABS_VOICE_ID
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
        
        headers = {
            "xi-api-key": self.settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
        }
        
        data = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }
        
        if language:
            data["voice_settings"]["language"] = language
        if speed != 1.0:
            data["voice_settings"]["speed"] = speed
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=headers) as response:
                if response.status != 200:
                    text = await response.text()
                    raise ValueError(f"TTS streaming failed: {response.status} - {text}")
                
                async for chunk in response.content.iter_chunked(1024):
                    yield chunk
    
    async def speech_to_text(
        self,
        audio_url: Optional[str] = None,
        audio_bytes: Optional[bytes] = None,
        language: Optional[str] = None,
        model: Optional[str] = None,
    ) -> STTResponse:
        """
        Convert speech to text using OpenRouter Whisper
        
        Args:
            audio_url: URL to audio file
            audio_bytes: Audio file bytes
            language: Language code (optional hint)
            model: STT model to use
            
        Returns:
            STTResponse with transcribed text
        """
        if not self.settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        # Use OpenRouter's Whisper model
        model = model or "openai/whisper-1"
        
        # Prepare audio data
        if audio_bytes:
            # Save to temp file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            
            try:
                # Upload to temporary storage or use directly
                # For OpenRouter, we can send the file directly
                url = f"{self.settings.OPENROUTER_BASE_URL}/audio/transcriptions"
                
                with open(tmp_path, "rb") as f:
                    files = {"file": ("audio.wav", f, "audio/wav")}
                    data = {
                        "model": model,
                        "language": language,
                    }
                    
                    headers = {
                        "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
                    }
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(url, data=data, files=files, headers=headers) as response:
                            if response.status != 200:
                                text = await response.text()
                                raise ValueError(f"STT failed: {response.status} - {text}")
                            
                            result = await response.json()
                            
                            return STTResponse(
                                text=result.get("text", ""),
                                confidence=result.get("confidence"),
                                language=result.get("language"),
                                duration_seconds=result.get("duration"),
                            )
            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        
        elif audio_url:
            # Download the audio file
            async with aiohttp.ClientSession() as session:
                async with session.get(audio_url) as response:
                    if response.status != 200:
                        raise ValueError(f"Failed to download audio: {response.status}")
                    
                    audio_bytes = await response.read()
                    return await self.speech_to_text(
                        audio_bytes=audio_bytes,
                        language=language,
                        model=model,
                    )
        
        else:
            raise ValueError("Either audio_url or audio_bytes must be provided")
    
    def generate_twiml_voice_response(
        self,
        response_text: str,
        voice: Optional[str] = None,
        language: Optional[str] = None,
    ) -> str:
        """
        Generate TwiML for voice response (TTS)
        
        Args:
            response_text: Text to speak
            voice: Voice type (man, woman, etc.)
            language: Language code
            
        Returns:
            TwiML XML string
        """
        response = VoiceResponse()
        
        # Use Twilio's built-in TTS
        voice_type = voice or "woman"
        lang = language or "en-US"
        
        response.say(response_text, voice=voice_type, language=lang)
        
        return str(response)
    
    def generate_twiml_gather(
        self,
        prompt: str,
        action_url: str,
        method: str = "POST",
        timeout: int = 5,
        finish_on_key: str = "#",
    ) -> str:
        """
        Generate TwiML for gathering voice input
        
        Args:
            prompt: Prompt to speak to the user
            action_url: URL to send the gathered input to
            method: HTTP method (POST or GET)
            timeout: Timeout in seconds
            finish_on_key: Key to finish input
            
        Returns:
            TwiML XML string
        """
        response = VoiceResponse()
        
        response.say(prompt)
        response.gather(
            action=action_url,
            method=method,
            timeout=timeout,
            finish_on_key=finish_on_key,
            input="speech",
        )
        
        return str(response)
    
    def generate_twiml_record(
        self,
        action_url: str,
        method: str = "POST",
        timeout: int = 30,
        finish_on_key: str = "#",
        max_length: int = 3600,
    ) -> str:
        """
        Generate TwiML for recording voice input
        
        Args:
            action_url: URL to send the recording to
            method: HTTP method
            timeout: Timeout in seconds
            finish_on_key: Key to finish recording
            max_length: Maximum recording length in seconds
            
        Returns:
            TwiML XML string
        """
        response = VoiceResponse()
        
        response.record(
            action=action_url,
            method=method,
            timeout=timeout,
            finish_on_key=finish_on_key,
            max_length=max_length,
            play_beep=True,
        )
        
        return str(response)
    
    def parse_incoming_call(self, request_data: dict[str, Any]) -> VoiceCall:
        """
        Parse incoming call from Twilio webhook
        
        Args:
            request_data: Dictionary of request parameters
            
        Returns:
            VoiceCall object
        """
        return VoiceCall(
            call_sid=request_data.get("CallSid", ""),
            from_=request_data.get("From", ""),
            to=request_data.get("To", ""),
            status=request_data.get("CallStatus", "ringing"),
            direction=request_data.get("Direction", "inbound"),
        )
    
    async def process_voice_input(
        self,
        audio_url: str,
        conversation_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Process voice input from a call
        
        Args:
            audio_url: URL to the recorded audio
            conversation_id: Optional existing conversation ID
            
        Returns:
            Dictionary with processing results
        """
        # Download and transcribe the audio
        stt_result = await self.speech_to_text(audio_url=audio_url)
        
        return {
            "type": "voice",
            "channel": ChannelType.VOICE,
            "text": stt_result.text,
            "confidence": stt_result.confidence,
            "duration_seconds": stt_result.duration_seconds,
            "conversation_id": conversation_id,
        }
    
    async def generate_voice_response(
        self,
        text: str,
        conversation_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Generate a voice response
        
        Args:
            text: Text to convert to speech
            conversation_id: Optional conversation ID
            
        Returns:
            Dictionary with response details
        """
        # Convert text to speech
        tts_result = await self.text_to_speech(text)
        
        return {
            "type": "voice",
            "channel": ChannelType.VOICE,
            "text": text,
            "audio_url": None,  # Would be uploaded to storage
            "audio_bytes": tts_result.audio_bytes,
            "duration_seconds": tts_result.duration_seconds,
            "conversation_id": conversation_id,
        }
    
    async def make_call(
        self,
        to: str,
        from_: Optional[str] = None,
        twiml_url: Optional[str] = None,
        twiml: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Make an outbound voice call
        
        Args:
            to: Recipient phone number
            from_: Sender phone number (defaults to configured)
            twiml_url: URL to fetch TwiML from
            twiml: Direct TwiML XML
            
        Returns:
            Call information
        """
        from twilio.rest import Client
        
        if not self.settings.TWILIO_ACCOUNT_SID or not self.settings.TWILIO_AUTH_TOKEN:
            raise ValueError("Twilio credentials not configured")
        
        client = Client(
            self.settings.TWILIO_ACCOUNT_SID,
            self.settings.TWILIO_AUTH_TOKEN,
        )
        
        from_ = from_ or self.settings.TWILIO_PHONE_NUMBER
        
        call = client.calls.create(
            url=twiml_url,
            to=to,
            from_=from_,
            twiml=twiml,
            method="POST",
        )
        
        return {
            "call_sid": call.sid,
            "status": call.status,
            "from": call.from_,
            "to": call.to,
            "date_created": call.date_created.isoformat() if call.date_created else None,
        }


# Singleton instance
_voice_service: Optional[VoiceService] = None


def get_voice_service() -> VoiceService:
    """Get the voice service singleton"""
    global _voice_service
    if _voice_service is None:
        _voice_service = VoiceService()
    return _voice_service
