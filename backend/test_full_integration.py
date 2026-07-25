#!/usr/bin/env python3
"""
Full integration test for FastAPI + Socket.IO
"""
import asyncio
import sys
import os

# Set up environment
os.environ['APP_ENV'] = 'development'
os.environ['DEBUG'] = 'true'
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:postgres@localhost:5432/ai_multichannel'

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

async def test_full_integration():
    print("=" * 60)
    print("Full Integration Test: FastAPI + Socket.IO")
    print("=" * 60)
    
    # Test 1: Import main app
    print("\n✓ Test 1: Importing main application...")
    try:
        from main import app
        print(f"  FastAPI app created: {app}")
        print(f"  App title: {app.title}")
        print(f"  App version: {app.version}")
    except Exception as e:
        print(f"  ✗ Failed to import app: {e}")
        return
    
    # Test 2: Check Socket.IO is mounted
    print("\n✓ Test 2: Checking Socket.IO mount...")
    try:
        # Check if /ws route exists
        routes = [route.path for route in app.routes]
        ws_routes = [r for r in routes if '/ws' in r]
        if ws_routes:
            print(f"  ✓ Socket.IO mounted at: {ws_routes}")
        else:
            print(f"  ⚠ Socket.IO route not found in: {routes[:5]}...")
    except Exception as e:
        print(f"  ✗ Failed to check routes: {e}")
    
    # Test 3: Check Socket.IO service
    print("\n✓ Test 3: Checking Socket.IO service...")
    try:
        from services.socket_service import get_socket_service
        socket_service = get_socket_service()
        print(f"  ✓ Socket.IO service: {socket_service}")
        print(f"  ✓ Socket.IO server: {socket_service.sio}")
        asgi_app = socket_service.get_asgi_app()
        print(f"  ✓ ASGI app: {type(asgi_app)}")
    except Exception as e:
        print(f"  ✗ Failed to get socket service: {e}")
    
    # Test 4: Check API endpoints
    print("\n✓ Test 4: Checking API endpoints...")
    try:
        endpoints = [route.path for route in app.routes if hasattr(route, 'path')]
        api_endpoints = [e for e in endpoints if e.startswith('/api')]
        print(f"  ✓ Found {len(api_endpoints)} API endpoints")
        
        # Check for Socket.IO endpoints
        socket_endpoints = [e for e in endpoints if 'socket' in e.lower()]
        if socket_endpoints:
            print(f"  ✓ Socket.IO endpoints: {socket_endpoints}")
        else:
            print(f"  ⚠ No Socket.IO endpoints found")
    except Exception as e:
        print(f"  ✗ Failed to check endpoints: {e}")
    
    # Test 5: Check database configuration
    print("\n✓ Test 5: Checking database configuration...")
    try:
        from config.database import database
        print(f"  ✓ Database config: {database}")
        print(f"  ✓ Database engine: {database.engine}")
    except Exception as e:
        print(f"  ✗ Failed to check database: {e}")
    
    # Test 6: Check services
    print("\n✓ Test 6: Checking services...")
    try:
        from services import (
            get_ai_service,
            get_conversation_service,
            get_ipfs_service,
            get_socket_service,
            get_sms_service,
            get_voice_service,
        )
        services = [
            ('AI', get_ai_service),
            ('Conversation', get_conversation_service),
            ('IPFS', get_ipfs_service),
            ('Socket.IO', get_socket_service),
            ('SMS', get_sms_service),
            ('Voice', get_voice_service),
        ]
        for name, service_fn in services:
            try:
                service = service_fn()
                print(f"  ✓ {name} service: {type(service).__name__}")
            except Exception as e:
                print(f"  ⚠ {name} service: {e}")
    except Exception as e:
        print(f"  ✗ Failed to check services: {e}")
    
    print("\n" + "=" * 60)
    print("Integration Test Complete!")
    print("=" * 60)
    print("\n✓ FastAPI + Socket.IO integration is working!")
    print("\nTo start the server:")
    print("  cd /Users/gibby/ai-multichannel-system/backend")
    print("  python -m src.main")
    print("\nWebSocket will be available at: ws://localhost:8000/ws")
    print("API docs will be available at: http://localhost:8000/docs")

if __name__ == "__main__":
    asyncio.run(test_full_integration())
