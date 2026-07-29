# AGENTS.md

## Cursor Cloud specific instructions

This repo is an **AI Multichannel System**: a FastAPI backend (`backend/`) plus a Next.js 14 frontend (`frontend/`). It uses PostgreSQL, Redis, and S3-compatible object storage. Standard commands live in `README.md`, `docker-compose.yml`, and `.circleci/config.yml`; this section only covers non-obvious, durable setup/run notes.

### Services & how to run them

The Python virtualenv lives at `/workspace/.venv`. Postgres and Redis are installed via apt but are **not auto-started** — start them at the beginning of a session:

```
sudo pg_ctlcluster 16 main start
sudo redis-server --daemonize yes
```

- **Backend (FastAPI, port 8000):** run from `backend/` so the `.env` and `PYTHONPATH` resolve correctly:
  `source /workspace/.venv/bin/activate && cd backend && PYTHONPATH=. python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload`
  Health: `GET /health`; interactive API docs at `/docs`.
- **Frontend (Next.js, port 3000):** `cd frontend && npm run dev` (root `/` redirects to `/chat`). See caveats below.
- **Tests (CI parity):** `cd backend && PYTHONPATH=. pytest tests/ -v` (uses `TestClient`; needs Postgres running).

### Non-obvious gotchas

- **Backend `.env` must only contain declared `Settings` fields.** `pydantic-settings` reads *every* key in `backend/.env` and rejects unknown ones (`extra_forbidden`). Notably there is **no `APP_ENV` field** — the field is `ENVIRONMENT`. Adding `APP_ENV=...` to `.env` will crash startup. (Env vars in the process environment are safe; only `.env` file keys are validated.) A working dev `backend/.env` already exists (gitignored).
- **`DEBUG=true` mounts `../frontend/public` as static files.** That directory must exist or the backend crashes on import. It is created by the update script (`mkdir -p frontend/public`); keep it present.
- **Object storage has a local-filesystem fallback.** When `S3_BUCKET` is empty (default in dev), uploads go to `LOCAL_STORAGE_PATH` (`/tmp/ai-multichannel-storage`) and are served back via `GET /api/storage/{key}`. No AWS credentials are needed for local development. Set the `S3_*` env vars (see `docker-compose.yml`) to use a real S3/R2 bucket.
- **DB schema is initialized from SQL, not Alembic.** `backend/alembic/env.py` is broken (`alembic upgrade head` fails with "No context has been configured yet"), and the model column `messages.message_metadata` does not match the Alembic migration's `metadata` column. Initialize/refresh the schema the way docker-compose does:
  `sudo -u postgres psql -d ai_multichannel -f backend/infra/init-db-v2.sql` (idempotent for tables/indexes). The dev DB is `ai_multichannel`, user/password `postgres`/`postgres`.

### Known pre-existing bugs (do not assume these are environment problems)

- **`frontend` dev server won't render pages as committed:** `frontend/postcss.config.js` lists `tailwindcss-animate` as a PostCSS plugin, but it is a *Tailwind* plugin, so `next dev`/`next build` fail with `"[object Object] is not a PostCSS plugin"`. `next build` additionally fails on a TypeScript error in `src/components/AlertDialog.tsx` (`AlertDialogPrimitive.Close` doesn't exist). These are application bugs, not setup issues.
- **`POST /api/conversations/{id}/messages` is broken:** `main.py` passes a `MessageCreate` Pydantic model into `Message(**message_data, ...)` without `.model_dump()`, raising "argument after ** must be a mapping". Conversation creation (`POST /api/conversations`) works and persists to Postgres.
- **Backend is not `black`/`isort` clean**, and `frontend` has no committed ESLint config (`next lint` prompts interactively). Neither is enforced by CI (CI only runs `pytest tests/`).
