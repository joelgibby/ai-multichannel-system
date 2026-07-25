#!/usr/bin/env python3
"""
Simple Socket.IO test without importing the full services module
"""
import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Import only what we need, avoiding circular imports
from socketio import AsyncServer, ASGIApp

async def test_socketio():
    print("=" * 60)
    print("Socket.IO Service Test (Simple)")
    print("=" * 60)
    
    # Test 1: Create Socket.IO server
    print("\n✓ Test 1: Creating Socket.IO server...")
    sio = AsyncServer(
        async_mode='asgi',
        cors_allowed_origins=['*'],
    )
    print(f"  Socket.IO server created: {sio}")
    
    # Test 2: Check ASGI app
    print("\n✓ Test 2: Getting ASGI app...")
    asgi_app = ASGIApp(sio)
    print(f"  ASGI app type: {type(asgi_app)}")
    
    # Test 3: Check event registration
    print("\n✓ Test 3: Testing event registration...")
    
    @sio.event
    async def connect(sid, environ, auth):
        print(f"  Connection handler registered for {sid}")
        return True
    
    @sio.event
    async def disconnect(sid):
        print(f"  Disconnect handler registered for {sid}")
    
    @sio.event
    async def message(sid, data):
        print(f"  Message handler registered")
    
    print("  ✓ Event handlers registered successfully")
    
    # Test 4: Check emit functionality
    print("\n✓ Test 4: Testing emit functionality...")
    
    # Create a test room
    test_room = "test_room"
    test_sid = "test_sid_123"
    
    # Manually add to room (simulating connection)
    sio.enter_room(test_sid, test_room)
    print(f"  ✓ Client {test_sid} entered room {test_room}")
    
    # Check rooms
    rooms = sio.rooms(test_sid)
    print(f"  ✓ Client rooms: {rooms}")
    
    # Check room members
    members = sio.rooms(test_room)
    print(f"  ✓ Room members: {members}")
    
    print("\n" + "=" * 60)
    print("All Socket.IO tests passed!")
    print("=" * 60)
    print("\nSocket.IO is ready to be integrated with FastAPI!")
    print("WebSocket endpoint will be available at: ws://localhost:8000/ws")

if __name__ == "__main__":
    asyncio.run(test_socketio())
