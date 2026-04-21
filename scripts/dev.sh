#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  dev.sh  –  Hate Kolom — Native Local Development Script
#  Run both Backend and Frontend locally without Docker.
#
#  Prerequisites (Native on Mac/Linux):
#    1. PostgreSQL running locally on port 5432
#    2. Redis running locally on port 6379
#    3. Python 3.11+
#    4. Node.js 22 LTS
#
#  Usage:
#    bash scripts/dev.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m';   GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';     NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${PROJECT_DIR}/backend"
FRONTEND_DIR="${PROJECT_DIR}/frontend"

BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"

# ============================================
# Override Docker hostnames for native Localhost
# ============================================
export DATABASE_URL=${DATABASE_URL:-"postgresql+asyncpg://postgres:@localhost:5432/hatekolom_db"}
export DATABASE_URL_SYNC=${DATABASE_URL_SYNC:-"postgresql://postgres:@localhost:5432/hatekolom_db"}
export REDIS_URL=${REDIS_URL:-"redis://localhost:6379/0"}
# Map NEXT_PUBLIC_API_URL locally
export NEXT_PUBLIC_API_URL="http://localhost:${BACKEND_PORT}/api/v1"
export PORT="${FRONTEND_PORT}"

echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Hate Kolom — Native Local Dev Server${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""

# Cleanup function to kill background processes on exit
cleanup() {
  echo -e "\n${RED}Stopping Native Dev Servers...${NC}"
  kill $(jobs -p) 2>/dev/null || true
  wait $(jobs -p) 2>/dev/null || true
  echo -e "${GREEN}Servers stopped gracefully.${NC}"
}
trap cleanup EXIT INT TERM

# ============================================
# 1. Backend
# ============================================
info "Setting up Backend..."
cd "${BACKEND_DIR}"

if [[ ! -d "venv" ]]; then
  info "Creating virtual environment..."
  python3 -m venv venv
fi
source venv/bin/activate

info "Installing/checking backend dependencies..."
pip install -r requirements.txt -q
pip install uvicorn -q

info "Generating database tables (auto-syncing schema)..."
python -c "
import asyncio
import os
from app.db import engine, Base
import app.models 

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(init_db())
"
alembic stamp head

info "Starting Backend on http://localhost:${BACKEND_PORT} ..."
# Start uvicorn in background
uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT} --reload &

# ============================================
# 2. Frontend
# ============================================
echo ""
info "Setting up Frontend..."
cd "${FRONTEND_DIR}"

info "Installing/checking frontend dependencies..."
npm install -q

info "Starting Frontend on http://localhost:${FRONTEND_PORT} ..."
# Start Next.js in background
npm run dev -- -p ${FRONTEND_PORT} &

echo ""
success "Everything is running! Streaming logs below..."
warn "Press Ctrl+C to stop both servers."
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"

# Wait indefinitely while logging
wait
