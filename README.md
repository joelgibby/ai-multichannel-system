# AI Multichannel System

> **Always-on AI interaction system with Voice, SMS, and Object Storage**

A comprehensive, production-ready system for interacting with AI models through multiple channels including voice calls, SMS (with rich media support), and web interfaces. Uses S3-compatible object storage and supports multiple AI model providers.

## Features

- **Multi-Channel AI Interaction**
  - Voice calls with real-time speech-to-text and text-to-speech
  - SMS with rich media (MMS) support
  - Web interface for chat and file uploads
  - Mobile-friendly API

- **AI Model Integration**
  - OpenRouter (100+ models including Mistral, Llama, etc.)
  - Streaming responses for real-time interaction
  - Conversation context management

- **Object Storage**
  - S3-compatible object storage
  - Local filesystem fallback for development
  - Automatic file type detection

- **Voice & SMS**
  - Twilio integration for SMS and voice
  - ElevenLabs for high-quality TTS
  - OpenRouter Whisper for STT
  - Webhook handling for incoming messages

- **Production Ready**
  - Native Docker and Docker Compose deployment
  - PostgreSQL database with async support
  - Redis for caching and background tasks
  - Nginx reverse proxy and health checks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Access (Anywhere)                   │
├─────────────────┬─────────────────┬─────────────────┬─────────┤
│   Web App        │   Mobile App     │   SMS (+1-XXX)   │  Voice   │
└────────┬────────┴────────┬────────┴─────────┬────────┴────┬────┘
         │                 │                  │             │
         ▼                 ▼                  ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                 Docker Compose (Native Host)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Nginx      │  │  FastAPI    │  │  Next.js Frontend       │  │
│  │  (proxy)    │──│  (API)      │  │  (chat UI)              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                           │
├─────────────────┬─────────────────┬─────────────────┬─────────┤
│  OpenRouter      │  S3 Storage     │  Twilio          │ElevenLabs│
│  (AI Models)     │  (Objects)      │  (SMS/Voice)     │ (TTS)    │
└─────────────────┴─────────────────┴─────────────────┴─────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Storage                                │
├─────────────────┬─────────────────┬─────────────────┐
│  PostgreSQL      │  Redis           │  Local/S3        │
│  (Database)      │  (Cache/Queue)   │  (Files)         │
└─────────────────┴─────────────────┴─────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- Or for local non-Docker development: Python 3.11+, PostgreSQL 15+, Redis 7+, Node.js 20+

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd ai-multichannel-system

# Copy environment file
cp .env.example .env

# Edit .env with your API keys
nano .env
```

### 2. Get API Keys

You'll need API keys for the following services:

| Service | Purpose | Where to Get | Free Tier |
|---------|---------|--------------|-----------|
| OpenRouter | AI Models | [openrouter.ai/keys](https://openrouter.ai/keys) | Yes |
| S3 / R2 / MinIO | Object storage | Your cloud provider | Varies |
| Twilio | SMS & Voice | [twilio.com](https://console.twilio.com/) | $15 credit |
| ElevenLabs | TTS | [elevenlabs.io](https://elevenlabs.io/) | Yes |

### 3. Run with Docker (recommended)

```bash
# Development stack (API :8000, frontend :3000, Postgres, Redis)
docker compose up --build

# Production stack behind nginx on :80
docker compose -f docker-compose.prod.yml up --build -d
```

API health: `http://localhost:8000/health`  
Frontend: `http://localhost:3000` (dev) or `http://localhost` (prod via nginx)

### 4. Local non-Docker setup (optional)

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

docker compose up -d db redis
cd backend && alembic upgrade head && cd ..
python -m uvicorn src.main:app --reload --app-dir backend
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`

## API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /` - Root endpoint

### AI
- `POST /api/ai/chat` - Chat with AI
- `POST /api/ai/chat/stream` - Stream AI responses
- `GET /api/ai/models` - List available AI models

### Object Storage
- `POST /api/storage/upload` - Upload file to object storage
- `GET /api/storage/{key}` - Download file by storage key

### SMS
- `POST /api/sms/send` - Send SMS
- `POST /api/sms/webhook` - Twilio webhook (for incoming SMS)

### Voice
- `POST /api/voice/call` - Make voice call
- `POST /api/voice/webhook` - Twilio voice webhook
- `POST /api/voice/tts` - Text-to-speech
- `POST /api/voice/stt` - Speech-to-text

### Conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/{id}` - Get conversation
- `POST /api/conversations/{id}/messages` - Add message
- `GET /api/conversations/{id}/messages` - List messages

## Deployment

### Native Docker Compose (recommended)

```bash
cp .env.example .env
# Set at least SECRET_KEY and POSTGRES_PASSWORD for production
openssl rand -hex 32   # paste into SECRET_KEY
openssl rand -hex 16   # paste into POSTGRES_PASSWORD

# Development
docker compose up --build

# Production (API + frontend + Postgres + Redis + Nginx)
docker compose -f docker-compose.prod.yml up --build -d

# View logs
docker compose -f docker-compose.prod.yml logs -f api

# Stop
docker compose -f docker-compose.prod.yml down
```

Point Twilio SMS/voice webhooks at your public host, for example:
- `https://your-domain/api/sms/webhook`
- `https://your-domain/api/voice/webhook`

### Manual Deployment

1. Deploy PostgreSQL and Redis
2. Build and run the API image (`Dockerfile` target `production`)
3. Build and run the frontend image (`frontend/Dockerfile` target `production`)
4. Put Nginx (or another reverse proxy) in front using `infra/nginx.conf`
5. Configure environment variables from `.env.example`
6. Run migrations (`alembic upgrade head`)

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

### Key Configuration

```bash
# Application
APP_ENV=production
DEBUG=false
SECRET_KEY=$(openssl rand -hex 32)

# Database
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/ai_multichannel

# AI
OPENROUTER_API_KEY=your_key
DEFAULT_AI_MODEL=mistralai/mistral-nemo

# Object Storage
S3_BUCKET=your_bucket
S3_ACCESS_KEY_ID=your_key
S3_SECRET_ACCESS_KEY=your_secret

# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# ElevenLabs
ELEVENLABS_API_KEY=your_key
```

## Database Migrations

```bash
# Create a new migration
cd backend
alembic revision --autogenerate -m "add_new_feature"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Testing

```bash
# Run tests
cd backend
pytest tests/ -v

# With coverage
pytest tests/ --cov=src --cov-report=html
```

## Project Structure

```
ai-multichannel-system/
├── backend/                    # Backend API
│   ├── src/                   # Source code
│   ├── requirements.txt       # Python dependencies
│   ├── alembic/               # Database migrations
│   └── tests/                 # Tests
├── frontend/                  # Frontend (React/Next.js)
│   ├── src/                   # Source code
│   ├── public/                # Static files
│   ├── Dockerfile             # Frontend image
│   └── package.json           # Node dependencies
├── infra/                     # Infrastructure
│   ├── nginx.conf             # Nginx reverse proxy
│   └── init-db.sql            # Database init
├── .env.example               # Environment template
├── Dockerfile                 # Backend image
├── docker-compose.yml         # Local development stack
├── docker-compose.prod.yml    # Production stack
└── README.md                  # This file
```

## Cost Estimate

| Service | Estimated Cost (Monthly) | Notes |
|---------|------------------------|-------|
| Docker host / VPS | $5-20 | Native Docker hosting |
| OpenRouter | $1-10 | AI model usage |
| S3 / object storage | $0-5 | File storage |
| Twilio | $1-10 | SMS/Voice usage |
| ElevenLabs | $1-5 | TTS usage |
| PostgreSQL | $0-15 | Included in Compose or managed |
| Redis | $0-5 | Included in Compose or managed |
| **Total** | **$7-65** | Depends on usage |

## Security Considerations

1. **API Keys**: Never commit API keys to version control
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Configure CORS origins properly
4. **Rate Limiting**: Implement rate limiting
5. **Authentication**: Use JWT tokens for API access
6. **Input Validation**: All inputs are validated
7. **SQL Injection**: Use parameterized queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-username/ai-multichannel-system/issues)
- Discussions: [GitHub Discussions](https://github.com/your-username/ai-multichannel-system/discussions)

## Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [OpenRouter](https://openrouter.ai/) - AI model aggregation
- [Twilio](https://twilio.com/) - SMS and voice
- [ElevenLabs](https://elevenlabs.io/) - Text-to-speech
- [Docker](https://www.docker.com/) - Native container deployment

---

**Built with ❤️ for the AI community**
