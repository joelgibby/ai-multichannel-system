"""
Main FastAPI application for AI Multichannel System
"""
import logging
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .config.database import Base, database, get_db
from .config.settings import get_settings, settings
from .models import (
    Conversation,
    ConversationCreate,
    ConversationInDB,
    FileStorage,
    FileStorageCreate,
    Message,
    MessageCreate,
    MessageInDB,
    User,
    UserCreate,
    UserInDB,
)
from .schemas.response import ErrorResponse, SuccessResponse
from .services import (
    get_ai_service,
    get_auth_service,
    get_conversation_service,
    get_s3_service,
    get_sms_service,
    get_socket_service,
    get_voice_service,
)
from .services.ai_service import AIService, ChatMessage, ChatRequest, ChatResponse
from .services.conversation_service import ConversationService
from .services.s3_service import S3Service, S3UploadResult, get_s3_service
from .services.sms_service import (
    IncomingSMS,
    SMSMessage,
    SMSResponse,
    SMSService,
    validate_twilio_signature,
)
from .services.socket_service import SocketService
from .services.voice_service import (
    STTResponse,
    VoiceCall,
    VoiceRequest,
    VoiceResponse,
    VoiceService,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Initialize Socket.IO service at module level (before FastAPI app creation)
_socket_service = get_socket_service()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting AI Multichannel System...")
    
    # Initialize services
    await get_s3_service()
    
    logger.info("Application started successfully")
    logger.info("Socket.IO available at ws://localhost:8000/ws")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Multichannel System...")
    
    # Close database connections
    await database.close()
    
    # Close services
    ai_service = get_ai_service()
    await ai_service.close()
    
    logger.info("Application shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Multichannel System - Voice, SMS, and Object Storage",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.cors_allow_methods_list,
    allow_headers=settings.cors_allow_headers_list,
)


# Mount Socket.IO ASGI app at root - it will handle /socket.io/ by default
socket_asgi_app = _socket_service.get_asgi_app()
app.mount("/socket.io", socket_asgi_app)

# Dependency to get services
def get_ai_service_dep() -> AIService:
    return get_ai_service()


async def get_s3_service_dep() -> S3Service:
    return await get_s3_service()


def get_sms_service_dep() -> SMSService:
    return get_sms_service()


def get_voice_service_dep() -> VoiceService:
    return get_voice_service()


def get_conversation_service_dep() -> ConversationService:
    return get_conversation_service()


_sms_send_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_sms_send_bearer = HTTPBearer(auto_error=False)


def require_sms_send_auth(
    api_key: Optional[str] = Security(_sms_send_api_key_header),
    creds: Optional[HTTPAuthorizationCredentials] = Security(_sms_send_bearer),
) -> None:
    """Require an API key or a valid JWT before sending SMS."""
    presented_key = (api_key or "").strip()
    presented_bearer = (creds.credentials.strip() if creds and creds.credentials else "")
    expected = (get_settings().SMS_SEND_API_KEY or "").strip()

    if expected:
        if presented_key and secrets.compare_digest(presented_key, expected):
            return
        if presented_bearer and secrets.compare_digest(presented_bearer, expected):
            return

    if presented_bearer:
        try:
            get_auth_service().decode_token(presented_bearer)
            return
        except JWTError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid credentials for sending SMS",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _twilio_request_payload(request: Request) -> dict[str, str]:
    """Read Twilio webhook fields from form, JSON, or query string."""
    content_type = (request.headers.get("content-type") or "").lower()
    payload: dict[str, str] = {}

    if "application/json" in content_type:
        body = await request.json()
        if isinstance(body, dict):
            payload = {
                str(key): "" if value is None else str(value)
                for key, value in body.items()
            }
    else:
        form_data = await request.form()
        for key, value in form_data.items():
            if hasattr(value, "read"):
                continue
            payload[str(key)] = str(value)

    for key, value in request.query_params.multi_items():
        if not payload.get(key):
            payload[str(key)] = str(value)

    return payload


def _is_production_runtime() -> bool:
    settings = get_settings()
    app_env = (os.getenv("APP_ENV") or settings.ENVIRONMENT or "").lower()
    return settings.is_production or app_env == "production"


def _twilio_webhook_urls(request: Request) -> list[str]:
    path = request.url.path
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.netloc
    )
    public = (get_settings().PUBLIC_API_BASE_URL or "").rstrip("/")
    candidates = [
        f"{public}{path}" if public else "",
        f"{proto}://{host}{path}",
        str(request.url),
    ]
    urls: list[str] = []
    for url in candidates:
        if url and url not in urls:
            urls.append(url)
    return urls


def require_twilio_webhook_signature(request: Request, params: dict[str, str]) -> None:
    """Reject forged Twilio webhooks when a signature is required or present."""
    token = (get_settings().TWILIO_AUTH_TOKEN or "").strip()
    signature = (request.headers.get("X-Twilio-Signature") or "").strip()
    required = _is_production_runtime()

    if not token:
        if required:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Twilio auth token is not configured",
            )
        return
    if not signature:
        if required:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing Twilio signature",
            )
        return

    if any(
        validate_twilio_signature(token, url, params, signature)
        for url in _twilio_webhook_urls(request)
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid Twilio signature",
    )


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler"""
    logger.error(f"Error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse.from_exception(exc).model_dump(),
    )


# Health check endpoint
@app.get("/health", response_model=SuccessResponse[dict[str, str]])
async def health_check() -> SuccessResponse[dict[str, str]]:
    """Health check endpoint"""
    return SuccessResponse(
        data={"status": "healthy", "version": settings.APP_VERSION},
        message="Service is running",
    )


# AI Endpoints
@app.post("/api/ai/chat", response_model=SuccessResponse[ChatResponse])
async def chat_with_ai(
    request: ChatRequest,
    ai_service: AIService = Depends(get_ai_service_dep),
) -> SuccessResponse[ChatResponse]:
    """
    Chat with AI model
    
    Send a list of messages and get an AI response.
    """
    try:
        response = await ai_service.chat(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=request.stream,
        )
        return SuccessResponse(data=response)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ai/chat/stream")
async def chat_with_ai_stream(
    request: ChatRequest,
    ai_service: AIService = Depends(get_ai_service_dep),
):
    """
    Stream chat responses from AI model
    
    Returns a streaming response.
    """
    try:
        generator = ai_service.chat_stream(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        
        async def generate():
            async for chunk in generator:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/ai/models", response_model=SuccessResponse[list[dict[str, Any]]])
async def list_ai_models(
    ai_service: AIService = Depends(get_ai_service_dep),
) -> SuccessResponse[list[dict[str, Any]]]:
    """List available AI models"""
    try:
        models = await ai_service.list_models()
        return SuccessResponse(data=models)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Object Storage Endpoints
from fastapi import UploadFile, File
import mimetypes


@app.post("/api/storage/upload", response_model=SuccessResponse[S3UploadResult])
async def upload_to_storage(
    file: UploadFile = File(...),
    s3_service: S3Service = Depends(get_s3_service_dep),
) -> SuccessResponse[S3UploadResult]:
    """Upload a file to S3-compatible object storage."""
    try:
        content = await file.read()
        result = await s3_service.upload_bytes(
            content=content,
            original_filename=file.filename or "upload.bin",
        )
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/storage/{key:path}")
async def download_from_storage(
    key: str,
    s3_service: S3Service = Depends(get_s3_service_dep),
):
    """Download a file by its storage key."""
    try:
        content = await s3_service.download_file(key=key)
        media_type, _ = mimetypes.guess_type(key)
        return Response(
            content=content,
            media_type=media_type or "application/octet-stream",
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# SMS Endpoints
@app.post("/api/sms/send", response_model=SuccessResponse[SMSResponse])
async def send_sms(
    sms: SMSMessage,
    sms_service: SMSService = Depends(get_sms_service_dep),
    _: None = Depends(require_sms_send_auth),
) -> SuccessResponse[SMSResponse]:
    """
    Send an SMS via Twilio.

    Requires `X-API-Key` or `Authorization: Bearer` matching `SMS_SEND_API_KEY`,
    or a valid JWT access token.
    """
    try:
        response = sms_service.send_sms(
            to=sms.to,
            body=sms.body,
            media_urls=sms.media_urls,
            from_=sms.from_,
        )
        return SuccessResponse(data=response)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sms/webhook")
async def sms_webhook(
    request: Request,
    sms_service: SMSService = Depends(get_sms_service_dep),
    conversation_service: ConversationService = Depends(get_conversation_service_dep),
):
    """
    Twilio SMS webhook.

    Point the number's Messaging webhook (HTTP POST) at
    `{PUBLIC_API_BASE_URL}/api/sms/webhook`.
    """
    try:
        payload = await _twilio_request_payload(request)
        require_twilio_webhook_signature(request, payload)
        incoming_sms = sms_service.parse_incoming_sms(payload)
        if not incoming_sms.body.strip():
            twiml = sms_service.generate_twiml_response(
                "I didn't get any text. Please send a message."
            )
            return Response(content=twiml, media_type="application/xml")
        result = await conversation_service.process_sms(incoming_sms)
        reply = (result.get("response_text") or "").strip()
        if result.get("duplicate") and not reply:
            twiml = sms_service.generate_twiml_response("")
            return Response(content=twiml, media_type="application/xml")
        twiml = sms_service.generate_twiml_response(
            reply or "I received your message."
        )
        return Response(content=twiml, media_type="application/xml")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMS webhook error: {e}", exc_info=True)
        twiml = sms_service.generate_twiml_response(
            "Sorry, I couldn't process that message. Please try again."
        )
        return Response(content=twiml, media_type="application/xml")


# Voice Endpoints
@app.post("/api/voice/call", response_model=SuccessResponse[dict[str, Any]])
async def make_voice_call(
    to: str,
    twiml_url: Optional[str] = None,
    twiml: Optional[str] = None,
    voice_service: VoiceService = Depends(get_voice_service_dep),
) -> SuccessResponse[dict[str, Any]]:
    """
    Make a voice call
    
    Initiate an outbound voice call via Twilio.
    """
    try:
        result = await voice_service.make_call(
            to=to,
            twiml_url=twiml_url,
            twiml=twiml,
        )
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/voice/webhook")
async def voice_webhook(
    request: Request,
    voice_service: VoiceService = Depends(get_voice_service_dep),
    conversation_service: ConversationService = Depends(get_conversation_service_dep),
):
    """
    Twilio voice webhook.

    Point the number's Voice webhook (HTTP POST) at
    `{PUBLIC_API_BASE_URL}/api/voice/webhook`.
    """
    try:
        payload = await _twilio_request_payload(request)
        require_twilio_webhook_signature(request, payload)
        call = voice_service.parse_incoming_call(payload)
        result = await conversation_service.process_voice_call(call, payload)
        twiml = result.get("twiml") or voice_service.generate_twiml_voice_response(
            "Hello, how can I help you?"
        )
        return Response(content=twiml, media_type="application/xml")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice webhook error: {e}", exc_info=True)
        twiml = voice_service.generate_twiml_voice_response(
            "Sorry, I couldn't process that call. Please try again."
        )
        return Response(content=twiml, media_type="application/xml")


@app.post("/api/voice/tts", response_model=SuccessResponse[VoiceResponse])
async def text_to_speech(
    request: VoiceRequest,
    voice_service: VoiceService = Depends(get_voice_service_dep),
) -> SuccessResponse[VoiceResponse]:
    """
    Convert text to speech
    
    Generate audio from text using ElevenLabs.
    """
    try:
        response = await voice_service.text_to_speech(
            text=request.text,
            voice_id=request.voice_id,
            language=request.language,
            speed=request.speed,
        )
        return SuccessResponse(data=response)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/voice/stt", response_model=SuccessResponse[STTResponse])
async def speech_to_text(
    audio_url: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    language: Optional[str] = None,
    voice_service: VoiceService = Depends(get_voice_service_dep),
) -> SuccessResponse[STTResponse]:
    """
    Convert speech to text
    
    Transcribe audio using OpenRouter Whisper.
    """
    try:
        response = await voice_service.speech_to_text(
            audio_url=audio_url,
            audio_bytes=audio_bytes,
            language=language,
        )
        return SuccessResponse(data=response)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Conversation Endpoints
@app.post("/api/conversations", response_model=SuccessResponse[ConversationInDB])
async def create_conversation(
    conversation: ConversationCreate,
    conversation_service: ConversationService = Depends(get_conversation_service_dep),
) -> SuccessResponse[ConversationInDB]:
    """
    Create a new conversation
    """
    try:
        result = await conversation_service.create_conversation(conversation)
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/conversations/{conversation_id}", response_model=SuccessResponse[ConversationInDB])
async def get_conversation(
    conversation_id: str,
    conversation_service: ConversationService = Depends(get_conversation_service_dep),
) -> SuccessResponse[ConversationInDB]:
    """
    Get a conversation by ID
    """
    try:
        result = await conversation_service.get_conversation(conversation_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/conversations/{conversation_id}/messages", response_model=SuccessResponse[MessageInDB])
async def add_message_to_conversation(
    conversation_id: str,
    message: MessageCreate,
    conversation_service: ConversationService = Depends(get_conversation_service_dep),
) -> SuccessResponse[MessageInDB]:
    """
    Add a message to a conversation
    """
    try:
        result = await conversation_service.add_message(conversation_id, message)
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/conversations/{conversation_id}/messages", response_model=SuccessResponse[list[MessageInDB]])
async def get_conversation_messages(
    conversation_id: str,
    limit: int = 50,
    offset: int = 0,
    conversation_service: ConversationService = Depends(get_conversation_service_dep),
) -> SuccessResponse[list[MessageInDB]]:
    """
    Get messages from a conversation
    """
    try:
        result = await conversation_service.get_messages(conversation_id, limit, offset)
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Import json for streaming
import json


# Socket.IO Endpoints
@app.post("/api/socket/broadcast")
async def socket_broadcast(
    event: str,
    data: dict[str, Any],
    room: Optional[str] = None,
    conversation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    socket_service: SocketService = Depends(get_socket_service),
) -> SuccessResponse[dict[str, Any]]:
    """
    Broadcast an event via Socket.IO
    
    This endpoint allows the backend to broadcast events to connected clients.
    """
    try:
        if room:
            count = await socket_service.emit_to_room(room, event, data)
        elif conversation_id:
            count = await socket_service.emit_to_conversation(conversation_id, event, data)
        elif user_id:
            count = await socket_service.emit_to_user(user_id, event, data)
        else:
            # Broadcast to all connected clients
            count = await socket_service.sio.emit(event, data)
        
        return SuccessResponse(
            data={"recipients": count, "event": event},
            message=f"Broadcasted {event} to {count} recipients"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/socket/status")
async def socket_status(
    socket_service: SocketService = Depends(get_socket_service),
) -> SuccessResponse[dict[str, Any]]:
    """
    Get Socket.IO connection status
    """
    try:
        count = await socket_service.get_connection_count()
        return SuccessResponse(
            data={
                "connected_clients": count,
                "status": "running",
                "websocket_url": f"ws://{settings.HOST}:{settings.PORT}/ws",
            },
            message="Socket.IO is running"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def _frontend_static_dir() -> Optional[Path]:
    """Resolve frontend/public when present; skip in Docker where only backend is mounted."""
    candidates = [
        Path(__file__).resolve().parents[2] / "frontend" / "public",
        Path("/frontend/public"),
    ]
    for path in candidates:
        if path.is_dir():
            return path
    return None


# Mount static files (for frontend) when the directory exists
_static_dir = _frontend_static_dir()
if settings.DEBUG and _static_dir is not None:
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

LEGAL_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/privacy", include_in_schema=False)
async def privacy_policy() -> FileResponse:
    """Public privacy policy (required for SMS/voice compliance)."""
    return FileResponse(LEGAL_DIR / "privacy.html", media_type="text/html")


@app.get("/terms", include_in_schema=False)
async def terms_and_conditions() -> FileResponse:
    """Public terms and conditions."""
    return FileResponse(LEGAL_DIR / "terms.html", media_type="text/html")


@app.get("/legal.css", include_in_schema=False)
async def legal_stylesheet() -> FileResponse:
    """Stylesheet for legal pages."""
    return FileResponse(LEGAL_DIR / "legal.css", media_type="text/css")


# Root endpoint
@app.get("/", response_model=SuccessResponse[dict[str, str]])
async def root() -> SuccessResponse[dict[str, str]]:
    """Root endpoint"""
    return SuccessResponse(
        data={
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
        },
        message="Welcome to AI Multichannel System",
    )


# Run the application
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )
