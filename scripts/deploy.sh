#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  deploy.sh  –  Hate Kolom — Native Deployment (PM2 + Nginx)
#  Run as the 'eyakub' user on a server bootstrapped by server-setup.sh.
#
#  What it does:
#    1. Creates the project PostgreSQL database (if it doesn't exist)
#    2. Sets up Python venv + installs backend deps
#    3. Runs Alembic database migrations
#    4. Builds Next.js frontend (standalone mode)
#    5. Starts/restarts backend + frontend via PM2
#    6. Configures Nginx reverse proxy
#    7. Saves PM2 process list for boot persistence
#
#  Usage:
#    cd ~/apps/lms && bash scripts/deploy.sh
#
#  Environment (optional overrides):
#    DB_NAME=hatekolom_db  DB_USER=eyakub  DB_PASSWORD=secret
#    BACKEND_PORT=8000  FRONTEND_PORT=3000
#    DOMAIN=yourdomain.com
#
#  Re-deploy (update only):
#    cd ~/apps/lms && git pull && bash scripts/deploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m';   GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';     NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Config (with defaults) ───────────────────────────────────
PROJECT_NAME="${PROJECT_NAME:-lms}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${PROJECT_DIR}/backend"
FRONTEND_DIR="${PROJECT_DIR}/frontend"

DB_NAME="${DB_NAME:-hatekolom_db}"
DB_USER="${DB_USER:-eyakub}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
DOMAIN="${DOMAIN:-hatekolom.org}"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Hate Kolom — Deploy (${PROJECT_NAME})${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
info "Project dir:    ${PROJECT_DIR}"
info "Backend port:   ${BACKEND_PORT}"
info "Frontend port:  ${FRONTEND_PORT}"
info "Database:       ${DB_NAME} (user: ${DB_USER})"
echo ""

# ═════════════════════════════════════════════════════════════
# 1. PostgreSQL Database
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 1. Database Setup ───────────────────────────────────${NC}"

# Create database if it doesn't exist
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  success "Database '${DB_NAME}' already exists"
else
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  success "Database '${DB_NAME}' created (owner: ${DB_USER})"
fi

# Set password if provided
if [[ -n "${DB_PASSWORD}" ]]; then
  sudo -u postgres psql -c "ALTER USER ${DB_USER} PASSWORD '${DB_PASSWORD}';" &>/dev/null
  success "Password set for user '${DB_USER}'"
fi

# ═════════════════════════════════════════════════════════════
# 2. Backend Setup
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 2. Backend Setup ────────────────────────────────────${NC}"

cd "${BACKEND_DIR}"

# Create virtual environment if it doesn't exist
if [[ ! -d "venv" ]]; then
  python3 -m venv venv
  success "Virtual environment created"
else
  success "Virtual environment exists"
fi

# Activate and install dependencies
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
pip install gunicorn uvicorn -q
success "Backend dependencies installed"

# Check for .env.prod
if [[ ! -f ".env.prod" ]]; then
  if [[ -f ".env.prod.example" ]]; then
    warn "No .env.prod found — copying from .env.prod.example"
    cp .env.prod.example .env.prod
    warn "EDIT .env.prod with real values before going live!"
  else
    die "No .env.prod or .env.prod.example found in ${BACKEND_DIR}"
  fi
fi

# ═════════════════════════════════════════════════════════════
# 3. Database Migrations
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 3. Database Migrations ──────────────────────────────${NC}"

cd "${BACKEND_DIR}"
source venv/bin/activate

# Source .env.prod for migration
set -a
source .env.prod
set +a

# Safely generate full schema natively bypassing the broken initial alembic file
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
# Synchronize Alembic state natively
alembic stamp head
success "Database schema generated and stamped successfully"
deactivate

# ═════════════════════════════════════════════════════════════
# 4. Frontend Build
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 4. Frontend Build ───────────────────────────────────${NC}"

cd "${FRONTEND_DIR}"

# Install Node.js dependencies (need dev dependencies for Next.js build)
npm ci --include=dev
success "Frontend dependencies installed"

# Build Next.js (standalone mode) with environment variables injected for static generation
NEXT_PUBLIC_SITE_URL="https://${DOMAIN}" NEXT_PUBLIC_API_URL="https://${DOMAIN}/api/v1" npm run build
success "Frontend built (standalone)"

# ═════════════════════════════════════════════════════════════
# 5. PM2 Process Management
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 5. PM2 Processes ────────────────────────────────────${NC}"

# Create PM2 ecosystem config
cat > "${PROJECT_DIR}/ecosystem.config.js" <<ECOSYSTEM
module.exports = {
  apps: [
    {
      name: '${PROJECT_NAME}-backend',
      cwd: '${BACKEND_DIR}',
      interpreter: '${BACKEND_DIR}/venv/bin/python',
      script: '${BACKEND_DIR}/venv/bin/gunicorn',
      args: 'app.main:app --worker-class uvicorn.workers.UvicornWorker --workers 1 --bind 127.0.0.1:${BACKEND_PORT} --timeout 120 --graceful-timeout 30',
      env_file: '${BACKEND_DIR}/.env.prod',
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '${PROJECT_DIR}/logs/backend-error.log',
      out_file: '${PROJECT_DIR}/logs/backend-out.log',
      merge_logs: true,
    },
    {
      name: '${PROJECT_NAME}-frontend',
      cwd: '${FRONTEND_DIR}',
      script: '.next/standalone/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '${FRONTEND_PORT}',
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_SITE_URL: 'https://${DOMAIN}',
        NEXT_PUBLIC_API_URL: 'https://${DOMAIN}/api/v1',
      },
      max_memory_restart: '384M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '${PROJECT_DIR}/logs/frontend-error.log',
      out_file: '${PROJECT_DIR}/logs/frontend-out.log',
      merge_logs: true,
    },
  ],
};
ECOSYSTEM
success "PM2 ecosystem config generated"

# Create logs directory
mkdir -p "${PROJECT_DIR}/logs"

# Copy static assets for standalone mode
if [[ -d "${FRONTEND_DIR}/.next/static" ]]; then
  cp -r "${FRONTEND_DIR}/.next/static" "${FRONTEND_DIR}/.next/standalone/.next/" 2>/dev/null || true
fi
if [[ -d "${FRONTEND_DIR}/public" ]]; then
  cp -r "${FRONTEND_DIR}/public" "${FRONTEND_DIR}/.next/standalone/" 2>/dev/null || true
fi
success "Static assets copied for standalone"

# Stop existing processes (if any), then start fresh
pm2 delete "${PROJECT_NAME}-backend" 2>/dev/null || true
pm2 delete "${PROJECT_NAME}-frontend" 2>/dev/null || true

pm2 start "${PROJECT_DIR}/ecosystem.config.js"
success "PM2 processes started"

# Save PM2 process list for auto-restart on reboot
pm2 save
success "PM2 process list saved for boot persistence"

# ═════════════════════════════════════════════════════════════
# 6. Nginx Configuration
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 6. Nginx Configuration ──────────────────────────────${NC}"

NGINX_SITE="/etc/nginx/sites-available/${PROJECT_NAME}"

# ── Guard: never overwrite an SSL-configured nginx block ──────
# Certbot modifies the nginx config after first deploy.
# Overwriting it destroys the SSL setup and redirects subdomains
# to the wrong domain. Skip the write if SSL is already present.
# To force a rewrite: NGINX_FORCE=1 bash scripts/deploy.sh
NGINX_HAS_SSL=false
if [[ -f "$NGINX_SITE" ]]; then
  if grep -q "listen 443\|ssl_certificate" "$NGINX_SITE" 2>/dev/null; then
    NGINX_HAS_SSL=true
  fi
fi

if [[ "${NGINX_FORCE:-0}" == "1" ]]; then
  warn "NGINX_FORCE=1 — overwriting nginx config (SSL will be reset, re-run certbot after)"
  NGINX_HAS_SSL=false
fi

if $NGINX_HAS_SSL; then
  warn "Nginx config already has SSL — skipping rewrite to preserve Certbot certificates"
  warn "To force rewrite: NGINX_FORCE=1 bash scripts/deploy.sh"
else
  info "Writing nginx config to ${NGINX_SITE}..."

  sudo tee "$NGINX_SITE" > /dev/null <<NGINX_CONF
# ── Hate Kolom (${PROJECT_NAME}) ──
# Auto-generated by deploy.sh — $(date +%Y-%m-%d)
# After first deploy, run: sudo certbot --nginx -d ${DOMAIN}
# On subsequent deploys this block is NOT overwritten (SSL preserved).

# Initialize the 10MB memory zone for API rate-limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    server_name ${DOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    client_max_body_size 100M;

    # ── API → Backend (Gunicorn on port ${BACKEND_PORT}) ──
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # ── Auth rate limiting (stricter) ──
    location /api/v1/auth/ {
        limit_req zone=api burst=3 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ── Health check ──
    location /health {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
    }

    # ── Static media from backend ──
    location /static/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # ── Next.js static assets (immutable cache) ──
    location /_next/static/ {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # ── Frontend → Next.js (port ${FRONTEND_PORT}) ──
    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF
  success "Nginx config written to ${NGINX_SITE}"

  # Enable site
  sudo ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/${PROJECT_NAME}"
  sudo rm -f /etc/nginx/sites-enabled/default
fi

# Always test and reload (even if we skipped the rewrite)
sudo nginx -t || die "Nginx config test failed"
sudo systemctl reload nginx
success "Nginx reloaded"

# ═════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Hate Kolom — Deployed Successfully!${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Processes:${NC}"
pm2 list
echo ""
echo -e "${BOLD}Endpoints:${NC}"
echo -e "  Frontend:  http://${DOMAIN}:80"
echo -e "  API:       http://${DOMAIN}:80/api/v1"
echo -e "  Health:    http://${DOMAIN}:80/health"
echo ""
echo -e "${BOLD}Useful Commands:${NC}"
echo -e "  ${GREEN}pm2 logs ${PROJECT_NAME}-backend${NC}      # Backend logs"
echo -e "  ${GREEN}pm2 logs ${PROJECT_NAME}-frontend${NC}     # Frontend logs"
echo -e "  ${GREEN}pm2 restart all${NC}                       # Restart everything"
echo -e "  ${GREEN}pm2 monit${NC}                             # Live monitoring"
echo ""
echo -e "${BOLD}Re-deploy:${NC}"
echo -e "  ${GREEN}cd ~/apps/lms && git pull && bash scripts/deploy.sh${NC}"
echo ""
if [[ "$DOMAIN" == "_" ]]; then
  echo -e "${BOLD}SSL Setup:${NC}"
  echo -e "  ${GREEN}sudo bash scripts/ssl.sh yourdomain.com admin@email.com${NC}"
  echo ""
fi
