#!/usr/bin/env bash
# Start the native Docker stack.
# Usage:
#   ./scripts/docker-up.sh           # development
#   ./scripts/docker-up.sh prod      # production

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "No .env found — copying .env.example"
  cp .env.example .env
  echo "Edit .env with your secrets, then re-run."
fi

MODE="${1:-dev}"

case "$MODE" in
  prod|production)
    docker compose -f docker-compose.prod.yml up --build -d
    echo "Production stack started. Open http://localhost${HTTP_PORT:+:$HTTP_PORT}"
    ;;
  *)
    docker compose up --build
    ;;
esac
