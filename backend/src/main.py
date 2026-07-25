"""
Main FastAPI application for AI Multichannel System
"""
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    get_conversation_service,
    get_ipfs_service,
    get_sms_service,
    get_socket_service,
    get_voice_service,
)
from .services.ai_service import AIService, ChatMessage, ChatResponse
from .services.conversation_service import ConversationService
from .services.ipfs_service import IPFSService, IPFSUploadResult
from .services.sms_service import IncomingSMS, SMSMessage, SMSResponse, SMSService
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
    await get_ipfs_service()
    
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
    description="AI Multichannel System - Voice, SMS, and IPFS Storage",
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
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount Socket.IO ASGI app at root - it will handle /socket.io/ by default
socket_asgi_app = _socket_service.get_asgi_app()
app.mount("/socket.io", socket_asgi_app)

# Dependency to get services
def get_ai_service_dep() -> AIService:
    return get_ai_service()


def get_ipfs_service_dep() -> IPFSService:
    return get_ipfs_service()


def get_sms_service_dep() -> SMSService:
    return get_sms_service()


def get_voice_service_dep() -> VoiceService:
    return get_voice_service()


def get_conversation_service_dep() -> ConversationService:
    return get_conversation_service()


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
    messages: list[ChatMessage],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    stream: bool = False,
    ai_service: AIService = Depends(get_ai_service_dep),
) -> SuccessResponse[ChatResponse]:
    """
    Chat with AI model
    
    Send a list of messages and get an AI response.
    """
    try:
        response = await ai_service.chat(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )
        return SuccessResponse(data=response)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ai/chat/stream")
async def chat_with_ai_stream(
    messages: list[ChatMessage],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    ai_service: AIService = Depends(get_ai_service_dep),
):
    """
    Stream chat responses from AI model
    
    Returns a streaming response.
    """
    try:
        generator = ai_service.chat_stream(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
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


# IPFS Storage Endpoints
from fastapi import UploadFile, File

@app.post("/api/ipfs/upload", response_model=SuccessResponse[IPFSUploadResult])
async def upload_to_ipfs(
    file: UploadFile = File(...),
    ipfs_service: IPFSService = Depends(get_ipfs_service_dep),
) -> SuccessResponse[IPFSUploadResult]:
    """
    Upload a file to IPFS
    
    Upload a file and get its CID and URL.
    """
    try:
        content = await file.read()
        result = await ipfs_service.upload_bytes(
            content=content,
            original_filename=file.filename,
        )
        return SuccessResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/ipfs/{cid}")
async def download_from_ipfs(
    cid: str,
    filename: Optional[str] = None,
    ipfs_service: IPFSService = Depends(get_ipfs_service_dep),
):
    """
    Download a file from IPFS
    
    Download a file by its CID.
    """
    try:
        content = await ipfs_service.download_file(cid=cid, filename=filename)
        return JSONResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# SMS Endpoints
@app.post("/api/sms/send", response_model=SuccessResponse[SMSResponse])
async def send_sms(
    sms: SMSMessage,
    sms_service: SMSService = Depends(get_sms_service_dep),
) -> SuccessResponse[SMSResponse]:
    """
    Send an SMS message
    
    Send an SMS via Twilio.
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
    Twilio SMS webhook endpoint
    
    Receive incoming SMS messages from Twilio.
    """
    try:
        # Parse form data
        form_data = await request.form()
        request_data = dict(form_data)
        
        # Parse incoming SMS
        incoming_sms = sms_service.parse_incoming_sms(request_data)
        
        # Process the SMS (this would involve AI, conversation management, etc.)
        result = await conversation_service.process_sms(incoming_sms)
        
        # Generate TwiML response
        if result.get("response_text"):
            twiml = sms_service.generate_twiml_response(result["response_text"])
            return JSONResponse(content={"twiml": twiml}, status_code=200)
        
        return JSONResponse(content={"status": "received"}, status_code=200)
    except Exception as e:
        logger.error(f"SMS webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


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
    Twilio voice webhook endpoint
    
    Receive voice call events from Twilio.
    """
    try:
        form_data = await request.form()
        request_data = dict(form_data)
        
        # Parse incoming call
        call = voice_service.parse_incoming_call(request_data)
        
        # Process the call
        result = await conversation_service.process_voice_call(call, request_data)
        
        # Generate TwiML response
        if result.get("twiml"):
            return JSONResponse(content={"twiml": result["twiml"]}, status_code=200)
        
        # Default response
        twiml = voice_service.generate_twiml_voice_response("Hello, how can I help you?")
        return JSONResponse(content={"twiml": twiml}, status_code=200)
    except Exception as e:
        logger.error(f"Voice webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


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


# Mount static files (for frontend)
if settings.DEBUG:
    app.mount("/static", StaticFiles(directory="../frontend/public"), name="static")


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
