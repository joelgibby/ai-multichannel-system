# AI Multichannel System

> **Always-on AI interaction system with Voice, SMS, and IPFS Storage**

A comprehensive, production-ready system for interacting with AI models through multiple channels including voice calls, SMS (with rich media support), and web interfaces. Uses IPFS for decentralized storage and supports multiple AI model providers.

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

- **IPFS Storage**
  - Web3.Storage integration
  - Support for Pinata, Filebase, and other providers
  - Automatic file type detection
  - Persistent storage with CID tracking

- **Voice & SMS**
  - Twilio integration for SMS and voice
  - ElevenLabs for high-quality TTS
  - OpenRouter Whisper for STT
  - Webhook handling for incoming messages

- **Production Ready**
  - Docker and Docker Compose support
  - Fly.io deployment configuration
  - PostgreSQL database with async support
  - Redis for caching and background tasks
  - Health checks and monitoring

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
│                    Fly.io / Docker (Backend)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  FastAPI    │  │  Celery     │  │    Conversation          │  │
│  │  (API)      │  │  (Tasks)     │  │    Management            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                           │
├─────────────────┬─────────────────┬─────────────────┬─────────┤
│  OpenRouter      │  Web3.Storage    │  Twilio          │ElevenLabs│
│  (AI Models)     │  (IPFS Storage)  │  (SMS/Voice)     │ (TTS)    │
└─────────────────┴─────────────────┴─────────────────┴─────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Storage                                │
├─────────────────┬─────────────────┬─────────────────┐
│  PostgreSQL      │  Redis           │  IPFS            │
│  (Database)      │  (Cache/Queue)   │  (Files)         │
└─────────────────┴─────────────────┴─────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker and Docker Compose (optional)
- Fly.io CLI (for deployment)

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
| Web3.Storage | IPFS Storage | [web3.storage](https://web3.storage/docs/how-tos/get-started/) | 5GB |
| Twilio | SMS & Voice | [twilio.com](https://console.twilio.com/) | $15 credit |
| ElevenLabs | TTS | [elevenlabs.io](https://elevenlabs.io/) | Yes |

### 3. Install Dependencies

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

### 4. Setup Database

```bash
# Install PostgreSQL locally or use Docker
# Using Docker:
docker-compose up -d db

# Wait for database to be ready
sleep 5

# Run migrations
cd backend
alembic upgrade head
cd ..
```

### 5. Run the Application

```bash
# Development
python -m uvicorn backend.src.main:app --reload

# Or with Docker Compose
docker-compose up -d
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

### IPFS Storage
- `POST /api/ipfs/upload` - Upload file to IPFS
- `GET /api/ipfs/{cid}` - Download file from IPFS

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

### Option 1: Docker Compose (Development/Production)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down
```

### Option 2: Fly.io (Recommended for Production)

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Create app
flyctl apps create ai-multichannel-system

# Set secrets (API keys)
flyctl secrets set \
  OPENROUTER_API_KEY=your_openrouter_key \
  WEB3_STORAGE_TOKEN=your_web3_storage_token \
  TWILIO_ACCOUNT_SID=your_twilio_sid \
  TWILIO_AUTH_TOKEN=your_twilio_token \
  TWILIO_PHONE_NUMBER=+1234567890 \
  ELEVENLABS_API_KEY=your_elevenlabs_key \
  SECRET_KEY=$(openssl rand -hex 32) \
  POSTGRES_PASSWORD=$(openssl rand -hex 16)

# Deploy
flyctl deploy

# Scale to multiple regions
flyctl regions add ewr sin ams

# View logs
flyctl logs
```

### Option 3: Manual Deployment

1. Deploy PostgreSQL (AWS RDS, Supabase, etc.)
2. Deploy Redis (AWS ElastiCache, Redis Labs, etc.)
3. Deploy the API (any cloud provider)
4. Configure environment variables
5. Run migrations
6. Start the application

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
DEFAULT_AI_MODEL=mistralai/mistral-7b-instruct

# IPFS
WEB3_STORAGE_TOKEN=your_token

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
│   │   ├── config/            # Configuration
│   │   ├── models/            # Database models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Business logic
│   │   ├── routes/            # API routes
│   │   ├── utils/             # Utilities
│   │   └── main.py            # FastAPI app
│   ├── requirements.txt       # Python dependencies
│   ├── alembic/               # Database migrations
│   └── tests/                 # Tests
├── frontend/                  # Frontend (React/Next.js)
│   ├── src/                   # Source code
│   ├── public/                # Static files
│   └── package.json           # Node dependencies
├── infra/                     # Infrastructure
│   ├── docker-compose.yml    # Docker Compose
│   ├── fly.toml               # Fly.io config
│   ├── nginx.conf             # Nginx config
│   └── init-db.sql            # Database init
├── .env.example               # Environment template
├── .gitignore                 # Git ignore
├── Dockerfile                 # Docker build
├── docker-compose.yml         # Docker Compose
└── README.md                  # This file
```

## Cost Estimate

| Service | Estimated Cost (Monthly) | Notes |
|---------|------------------------|-------|
| Fly.io | $5-10 | API hosting |
| OpenRouter | $1-10 | AI model usage |
| Web3.Storage | $0-5 | IPFS storage (5GB free) |
| Twilio | $1-10 | SMS/Voice usage |
| ElevenLabs | $1-5 | TTS usage |
| PostgreSQL | $0-15 | Database (free tiers available) |
| Redis | $0-5 | Cache (free tiers available) |
| **Total** | **$8-50** | Depends on usage |

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
- [Web3.Storage](https://web3.storage/) - IPFS storage
- [Twilio](https://twilio.com/) - SMS and voice
- [ElevenLabs](https://elevenlabs.io/) - Text-to-speech
- [Fly.io](https://fly.io/) - Deployment platform

---

**Built with ❤️ for the AI community**
