"""
Socket.IO Service for real-time communication

This service provides WebSocket-based real-time updates for:
- Message streaming
- Voice data transmission
- Connection status
- Typing indicators
- File upload progress
"""
import json
import logging
import uuid
from typing import Any, Callable, Coroutine, Dict, List, Optional, Set

from socketio import AsyncNamespace, AsyncServer

from ..config.settings import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class SocketService:
    """Socket.IO service for managing WebSocket connections"""
    
    def __init__(self):
        """Initialize the Socket.IO service"""
        self.sio = AsyncServer(
            async_mode='asgi',
            cors_allowed_origins=settings.cors_origins_list,
            logger=logger,
            engineio_logger=logger,
        )
        
        # Create the ASGI app
        self.asgi_app = self._create_asgi_app()
        
        # Track connected clients
        self.connected_clients: Dict[str, Set[str]] = {}  # room_name -> set of sid
        self.client_rooms: Dict[str, Set[str]] = {}  # sid -> set of room_name
        self.client_info: Dict[str, Dict[str, Any]] = {}  # sid -> client info
        
        # Register event handlers
        self._register_handlers()
    
    def _register_handlers(self) -> None:
        """Register Socket.IO event handlers"""
        
        @self.sio.event
        async def connect(sid: str, environ: Dict[str, Any], auth: Dict[str, Any]) -> bool:
            """Handle new client connection"""
            logger.info(f"Client connected: {sid}")
            
            # Store client info
            self.client_info[sid] = {
                'auth': auth,
                'connected_at': environ.get('time', ''),
                'ip': environ.get('REMOTE_ADDR', 'unknown'),
            }
            self.client_rooms[sid] = set()
            
            # Join default room (user's session)
            user_id = auth.get('user_id', 'anonymous')
            await self.join_room(sid, f'user:{user_id}')
            
            # Emit connection confirmation
            await self.sio.emit('connection', {
                'sid': sid,
                'status': 'connected',
                'user_id': user_id,
            }, to=sid)
            
            logger.info(f"Client {sid} connected and joined user:{user_id}")
            return True
        
        @self.sio.event
        async def disconnect(sid: str) -> None:
            """Handle client disconnection"""
            logger.info(f"Client disconnected: {sid}")
            
            # Remove from all rooms
            if sid in self.client_rooms:
                for room in list(self.client_rooms[sid]):
                    await self.leave_room(sid, room)
            
            # Clean up
            self.client_rooms.pop(sid, None)
            self.client_info.pop(sid, None)
            
            logger.info(f"Client {sid} disconnected and cleaned up")
        
        @self.sio.event
        async def join(sid: str, data: Dict[str, Any]) -> None:
            """Handle client joining a room"""
            room = data.get('room')
            if room:
                await self.join_room(sid, room)
                logger.info(f"Client {sid} joined room: {room}")
        
        @self.sio.event
        async def leave(sid: str, data: Dict[str, Any]) -> None:
            """Handle client leaving a room"""
            room = data.get('room')
            if room:
                await self.leave_room(sid, room)
                logger.info(f"Client {sid} left room: {room}")
        
        @self.sio.event
        async def subscribe(sid: str, data: Dict[str, Any]) -> None:
            """Subscribe to conversation updates"""
            conversation_id = data.get('conversation_id')
            if conversation_id:
                await self.join_room(sid, f'conversation:{conversation_id}')
                logger.info(f"Client {sid} subscribed to conversation: {conversation_id}")
        
        @self.sio.event
        async def unsubscribe(sid: str, data: Dict[str, Any]) -> None:
            """Unsubscribe from conversation updates"""
            conversation_id = data.get('conversation_id')
            if conversation_id:
                await self.leave_room(sid, f'conversation:{conversation_id}')
                logger.info(f"Client {sid} unsubscribed from conversation: {conversation_id}")
    
    async def join_room(self, sid: str, room: str) -> None:
        """Add client to a room"""
        self.sio.enter_room(sid, room)
        self.client_rooms[sid].add(room)
        self.connected_clients.setdefault(room, set()).add(sid)
    
    async def leave_room(self, sid: str, room: str) -> None:
        """Remove client from a room"""
        self.sio.leave_room(sid, room)
        self.client_rooms[sid].discard(room)
        self.connected_clients.get(room, set()).discard(sid)
    
    async def emit_to_room(self, room: str, event: str, data: Dict[str, Any]) -> int:
        """Emit event to all clients in a room"""
        count = await self.sio.emit(event, data, room=room, skip_sid=None)
        logger.debug(f"Emitted {event} to room {room}: {count} recipients")
        return count
    
    async def emit_to_user(self, user_id: str, event: str, data: Dict[str, Any]) -> int:
        """Emit event to a specific user"""
        room = f'user:{user_id}'
        return await self.emit_to_room(room, event, data)
    
    async def emit_to_conversation(self, conversation_id: str, event: str, data: Dict[str, Any]) -> int:
        """Emit event to all subscribers of a conversation"""
        room = f'conversation:{conversation_id}'
        return await self.emit_to_room(room, event, data)
    
    # Business logic methods
    
    async def broadcast_message(self, conversation_id: str, message: Dict[str, Any]) -> int:
        """Broadcast a new message to conversation subscribers"""
        return await self.emit_to_conversation(
            conversation_id,
            'message',
            {'message': message, 'conversation_id': conversation_id}
        )
    
    async def broadcast_stream_chunk(self, conversation_id: str, chunk: str, message_id: Optional[str] = None) -> int:
        """Broadcast a streaming chunk to conversation subscribers"""
        return await self.emit_to_conversation(
            conversation_id,
            'stream',
            {
                'chunk': chunk,
                'message_id': message_id,
                'conversation_id': conversation_id,
            }
        )
    
    async def broadcast_typing(self, conversation_id: str, user_id: str, is_typing: bool) -> int:
        """Broadcast typing indicator"""
        return await self.emit_to_conversation(
            conversation_id,
            'typing',
            {
                'user_id': user_id,
                'is_typing': is_typing,
                'conversation_id': conversation_id,
            }
        )
    
    async def broadcast_voice_data(self, conversation_id: str, data: Dict[str, Any]) -> int:
        """Broadcast voice data (audio chunks, transcription, etc.)"""
        return await self.emit_to_conversation(
            conversation_id,
            'voice:data',
            {**data, 'conversation_id': conversation_id}
        )
    
    async def broadcast_voice_start(self, conversation_id: str, user_id: str) -> int:
        """Broadcast voice recording started"""
        return await self.emit_to_conversation(
            conversation_id,
            'voice:start',
            {'user_id': user_id, 'conversation_id': conversation_id}
        )
    
    async def broadcast_voice_stop(self, conversation_id: str, user_id: str) -> int:
        """Broadcast voice recording stopped"""
        return await self.emit_to_conversation(
            conversation_id,
            'voice:stop',
            {'user_id': user_id, 'conversation_id': conversation_id}
        )
    
    async def broadcast_file_progress(self, conversation_id: str, progress: int, filename: str) -> int:
        """Broadcast file upload progress"""
        return await self.emit_to_conversation(
            conversation_id,
            'file:progress',
            {
                'progress': progress,
                'filename': filename,
                'conversation_id': conversation_id,
            }
        )
    
    async def broadcast_connection_status(self, user_id: str, status: str) -> int:
        """Broadcast connection status to user"""
        return await self.emit_to_user(
            user_id,
            'connection:status',
            {'status': status}
        )
    
    async def broadcast_error(self, conversation_id: str, error: str) -> int:
        """Broadcast error to conversation subscribers"""
        return await self.emit_to_conversation(
            conversation_id,
            'error',
            {'error': error, 'conversation_id': conversation_id}
        )
    
    # Utility methods
    
    def _create_asgi_app(self):
        """Create the ASGI application for Socket.IO"""
        from socketio import ASGIApp
        return ASGIApp(self.sio)
    
    def get_asgi_app(self):
        """Get the ASGI application for Socket.IO"""
        return self.asgi_app
    
    async def get_connection_count(self) -> int:
        """Get total number of connected clients"""
        return len(self.client_info)
    
    async def get_room_members(self, room: str) -> List[str]:
        """Get list of client SIDs in a room"""
        return list(self.connected_clients.get(room, set()))
    
    async def get_client_info(self, sid: str) -> Optional[Dict[str, Any]]:
        """Get information about a connected client"""
        return self.client_info.get(sid)


# Singleton instance
_socket_service: Optional[SocketService] = None


def get_socket_service() -> SocketService:
    """Get the singleton Socket.IO service instance"""
    global _socket_service
    if _socket_service is None:
        _socket_service = SocketService()
    return _socket_service
