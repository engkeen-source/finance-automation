#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[start]${NC} $1"; }
warn() { echo -e "${YELLOW}[start]${NC} $1"; }
err()  { echo -e "${RED}[start]${NC} $1"; }

cleanup() {
  log "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  log "Done."
}
trap cleanup EXIT INT TERM

# 1. Check prerequisites
command -v node >/dev/null 2>&1 || { err "Node.js is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || warn "psql not found — skipping database check."

# 2. Check Postgres is running
if command -v psql >/dev/null 2>&1; then
  if ! psql -h localhost -p 5432 -d finance_automation -c "SELECT 1" >/dev/null 2>&1; then
    warn "Cannot connect to PostgreSQL at localhost:5432/finance_automation"
    warn "Make sure Postgres is running and the database exists:"
    warn "  createdb finance_automation"
  fi
fi

# 3. Install dependencies if needed
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  log "Installing dependencies..."
  npm install --prefix "$ROOT_DIR"
fi

# 4. Run database setup/migrations
log "Running database migrations..."
npm run db:migrate --prefix "$ROOT_DIR" -w packages/backend 2>&1 || {
  warn "Migration failed — the backend may still start if the schema already exists."
}

# 5. Start backend
log "Starting backend on http://localhost:3001 ..."
npm run dev:backend --prefix "$ROOT_DIR" &
BACKEND_PID=$!

# 6. Wait briefly for backend to be ready
sleep 2

# 7. Start frontend
log "Starting frontend on http://localhost:5173 ..."
npm run dev:frontend --prefix "$ROOT_DIR" &
FRONTEND_PID=$!

log "Stack is running. Press Ctrl+C to stop."
wait
