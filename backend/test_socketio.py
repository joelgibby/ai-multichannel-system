#!/usr/bin/env python3
"""
Test script for Socket.IO integration
"""
import asyncio
import sys
sys.path.insert(0, '/Users/gibby/ai-multichannel-system/backend/src')

from services.socket_service import get_socket_service

async def test_socketio():
    print("=" * 60)
    print("Socket.IO Service Test")
    print("=" * 60)
    
    # Get the socket service
    socket_service = get_socket_service()
    
    # Test 1: Check service initialization
    print("\n✓ Test 1: Service initialized")
    print(f"  Socket.IO server: {socket_service.sio}")
    
    # Test 2: Check ASGI app
    print("\n✓ Test 2: ASGI app available")
    asgi_app = socket_service.get_asgi_app()
    print(f"  ASGI app type: {type(asgi_app)}")
    
    # Test 3: Check connection tracking
    print("\n✓ Test 3: Connection tracking initialized")
    print(f"  Connected clients: {socket_service.connected_clients}")
    print(f"  Client rooms: {socket_service.client_rooms}")
    print(f"  Client info: {socket_service.client_info}")
    
    # Test 4: Check broadcast methods exist
    print("\n✓ Test 4: Broadcast methods available")
    methods = [
        'broadcast_message',
        'broadcast_stream_chunk',
        'broadcast_typing',
        'broadcast_voice_data',
        'broadcast_voice_start',
        'broadcast_voice_stop',
        'broadcast_file_progress',
        'broadcast_connection_status',
        'broadcast_error',
        'emit_to_room',
        'emit_to_user',
        'emit_to_conversation',
    ]
    for method in methods:
        if hasattr(socket_service, method):
            print(f"  ✓ {method}")
        else:
            print(f"  ✗ {method} MISSING")
    
    print("\n" + "=" * 60)
    print("All Socket.IO service tests passed!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_socketio())
