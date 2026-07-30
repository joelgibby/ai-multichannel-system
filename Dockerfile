# AI Multichannel System Dockerfile
# Multi-stage build for production and development

# ============================================
# Stage 1: Base image with Python and system dependencies
# ============================================
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    POETRY_VERSION=1.7.0 \
    POETRY_HOME=/opt/poetry \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    PATH="/opt/poetry/bin:${PATH}"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Stage 2: Install Python dependencies
# ============================================
FROM base as builder

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Copy only requirements files first for better caching
WORKDIR /app
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# ============================================
# Stage 3: Final production image
# ============================================
FROM base as production

# Copy Python dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Create app directory
WORKDIR /app

# Copy application code
COPY backend/src/ ./src/
COPY backend/static/ ./static/
COPY backend/alembic.ini .
COPY backend/alembic/ ./alembic/

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# Set environment variables
ENV PYTHONPATH=/app \
    APP_ENV=production \
    DATABASE_URL=postgresql+asyncpg://user:password@db:5432/ai_multichannel

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()" || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ============================================
# Development image (includes dev dependencies)
# ============================================
FROM builder as development

# Copy application code
WORKDIR /app
COPY backend/ ./

# Install dev dependencies
RUN pip install -r requirements.txt

# Set environment variables
ENV PYTHONPATH=/app \
    APP_ENV=development \
    DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/ai_multichannel

# Expose port
EXPOSE 8000

# Run with hot reload
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
