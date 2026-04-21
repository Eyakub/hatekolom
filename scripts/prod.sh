#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  prod.sh  –  Happy Baby Native Production Manager (PM2 only)
#  Handles backend + frontend deployment WITHOUT touching Nginx or SSL.
#  Use this instead of deploy.sh when Nginx/Certbot is already configured.
#
#  Usage:
#    bash scripts/prod.sh               # full deploy (build + start)
#    bash scripts/prod.sh restart        # restart PM2 services
#    bash scripts/prod.sh stop           # stop PM2 services
#    bash scripts/prod.sh logs           # follow all logs
#    bash scripts/prod.sh status         # show PM2 + health check
#    bash scripts/prod.sh migrate        # run DB migrations only
#    bash scripts/prod.sh build          # rebuild only (no restart)
#
#  Multi-project / custom ports:
#    PROJECT_NAME=lms2 BACKEND_PORT=8002 FRONTEND_PORT=3002 bash scripts/prod.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m';   GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';     NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Paths ─────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
LOGS_DIR="$ROOT/logs"
ECOSYSTEM_FILE="$ROOT/ecosystem.config.js"

# ── Config (env overrides supported) ─────────────────────────
PROJECT_NAME="${PROJECT_NAME:-lms}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
DOMAIN="${DOMAIN:-lms.attirethreadsbd.com}"

BACKEND_ENV="$BACKEND_DIR/.env.prod"

# ── Preflight checks ─────────────────────────────────────────
preflight() {
  command -v node    &>/dev/null || die "Node.js not found — run server-setup.sh first"
  command -v npm     &>/dev/null || die "npm not found"
  command -v python3 &>/dev/null || die "python3 not found"
  command -v git     &>/dev/null || die "git not found"

  if ! command -v pm2 &>/dev/null; then
    info "PM2 not found — installing globally…"
    npm install -g pm2 -q
    success "PM2 installed"
  fi

  [[ -f "$BACKEND_ENV" ]] || die "Missing $BACKEND_ENV — copy backend/.env.prod.example → backend/.env.prod and fill in values"

  mkdir -p "$LOGS_DIR"
}

# ── Write ecosystem.config.js ─────────────────────────────────
write_ecosystem() {
  cat > "$ECOSYSTEM_FILE" <<ECOSYSTEM
module.exports = {
  apps: [
    {
      name: '${PROJECT_NAME}-backend',
      cwd: '${BACKEND_DIR}',
      interpreter: '${BACKEND_DIR}/venv/bin/python',
      script: '${BACKEND_DIR}/venv/bin/gunicorn',
      args: 'app.main:app --worker-class uvicorn.workers.UvicornWorker --workers 2 --bind 127.0.0.1:${BACKEND_PORT} --timeout 120 --graceful-timeout 30',
      env_file: '${BACKEND_ENV}',
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '${LOGS_DIR}/backend-error.log',
      out_file:   '${LOGS_DIR}/backend-out.log',
      merge_logs: true,
      watch: false,
    },
    {
      name: '${PROJECT_NAME}-frontend',
      cwd: '${FRONTEND_DIR}',
      script: '.next/standalone/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '${FRONTEND_PORT}',
        HOSTNAME: '127.0.0.1',
        NEXT_PUBLIC_SITE_URL: 'https://${DOMAIN}',
        NEXT_PUBLIC_API_URL:  'https://${DOMAIN}/api/v1',
      },
      max_memory_restart: '384M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '${LOGS_DIR}/frontend-error.log',
      out_file:   '${LOGS_DIR}/frontend-out.log',
      merge_logs: true,
      watch: false,
    },
  ],
};
ECOSYSTEM
  success "ecosystem.config.js written"
}

# ── Backend setup ─────────────────────────────────────────────
setup_backend() {
  echo -e "\n${BOLD}── Backend ──────────────────────────────────────────────${NC}"
  cd "$BACKEND_DIR"

  if [[ ! -d "venv" ]]; then
    python3 -m venv venv
    success "Python venv created"
  fi

  source venv/bin/activate
  pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt
  pip install --quiet gunicorn uvicorn
  success "Backend dependencies installed"

  # Migrations
  set -a; source "$BACKEND_ENV"; set +a
  info "Running database migrations…"
  alembic upgrade head
  success "Migrations applied"
  deactivate
}

# ── Frontend build ────────────────────────────────────────────
build_frontend() {
  echo -e "\n${BOLD}── Frontend ─────────────────────────────────────────────${NC}"
  cd "$FRONTEND_DIR"

  npm ci --include=dev --prefer-offline 2>/dev/null || npm install --include=dev
  success "Node dependencies installed"

  NEXT_PUBLIC_SITE_URL="https://${DOMAIN}" \
  NEXT_PUBLIC_API_URL="https://${DOMAIN}/api/v1" \
  npm run build
  success "Next.js built"

  # Copy standalone assets (Next.js standalone omits these)
  local STANDALONE="$FRONTEND_DIR/.next/standalone"
  if [[ -d "$STANDALONE" ]]; then
    [[ -d "$FRONTEND_DIR/.next/static" ]] && \
      cp -r "$FRONTEND_DIR/.next/static" "$STANDALONE/.next/static" 2>/dev/null || true
    [[ -d "$FRONTEND_DIR/public" ]] && \
      cp -r "$FRONTEND_DIR/public" "$STANDALONE/public" 2>/dev/null || true
    success "Static assets copied into standalone"
  else
    warn "No standalone output found — check next.config.ts has output: 'standalone'"
  fi
}

# ── Commands ──────────────────────────────────────────────────
cmd_deploy() {
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  LMS — Deploy (${PROJECT_NAME}) — $(date '+%Y-%m-%d %H:%M')${NC}"
  echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
  info "Domain:         $DOMAIN"
  info "Backend port:   $BACKEND_PORT"
  info "Frontend port:  $FRONTEND_PORT"
  info "Logs dir:       $LOGS_DIR"
  echo ""

  setup_backend
  build_frontend

  echo -e "\n${BOLD}── PM2 ──────────────────────────────────────────────────${NC}"
  write_ecosystem

  # Graceful: reload if running, start fresh otherwise
  if pm2 list | grep -q "${PROJECT_NAME}-backend"; then
    pm2 reload "$ECOSYSTEM_FILE" --update-env
    success "PM2 processes reloaded (zero-downtime)"
  else
    # Delete stale entries if any
    pm2 delete "${PROJECT_NAME}-backend"  2>/dev/null || true
    pm2 delete "${PROJECT_NAME}-frontend" 2>/dev/null || true
    pm2 start "$ECOSYSTEM_FILE"
    success "PM2 processes started"
  fi

  pm2 save
  success "PM2 saved for boot persistence"

  cmd_status
}

cmd_build() {
  setup_backend
  build_frontend
  write_ecosystem
  success "Build complete — run 'bash scripts/prod.sh restart' to apply"
}

cmd_restart() {
  echo -e "\n${BOLD}── Restarting ───────────────────────────────────────────${NC}"
  pm2 restart "${PROJECT_NAME}-backend"  || die "Backend not found in PM2"
  pm2 restart "${PROJECT_NAME}-frontend" || die "Frontend not found in PM2"
  pm2 save
  success "Restarted both services"
}

cmd_stop() {
  echo -e "\n${BOLD}── Stopping ─────────────────────────────────────────────${NC}"
  pm2 stop "${PROJECT_NAME}-backend"  2>/dev/null || warn "Backend wasn't running"
  pm2 stop "${PROJECT_NAME}-frontend" 2>/dev/null || warn "Frontend wasn't running"
  success "Services stopped"
}

cmd_logs() {
  echo -e "\n${BOLD}── Logs (Ctrl+C to exit) ────────────────────────────────${NC}"
  pm2 logs "${PROJECT_NAME}-backend" "${PROJECT_NAME}-frontend" --lines 50
}

cmd_status() {
  echo ""
  echo -e "${BOLD}── PM2 Status ──────────────────────────────────────────${NC}"
  pm2 list | grep -E "${PROJECT_NAME}|┌|├|└|│|─" 2>/dev/null || pm2 list

  echo ""
  echo -e "${BOLD}── Health Check ────────────────────────────────────────${NC}"
  local attempts=0
  while [[ $attempts -lt 6 ]]; do
    if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/v1/health" >/dev/null 2>&1; then
      local health
      health=$(curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/v1/health")
      echo -e "  ${GREEN}Backend:${NC}  http://127.0.0.1:${BACKEND_PORT}/api/v1"
      echo "$health" | python3 -m json.tool 2>/dev/null | sed 's/^/  /' || echo "  $health"
      break
    fi
    ((attempts++))
    sleep 2
  done
  if [[ $attempts -eq 6 ]]; then
    warn "Backend health check not responding yet (port ${BACKEND_PORT})"
    info "Check logs: bash scripts/prod.sh logs"
  fi

  echo ""
  echo -e "  ${GREEN}Frontend:${NC} http://127.0.0.1:${FRONTEND_PORT}"
  echo -e "  ${GREEN}Public:${NC}   https://${DOMAIN}"
  echo ""
}

cmd_migrate() {
  echo -e "\n${BOLD}── Migrations ───────────────────────────────────────────${NC}"
  cd "$BACKEND_DIR"
  source venv/bin/activate
  set -a; source "$BACKEND_ENV"; set +a
  alembic upgrade head
  success "Migrations applied"
  deactivate
}

cmd_help() {
  cat <<EOF

${BOLD}LMS Production Manager (PM2-only — no Nginx/SSL touched)${NC}

${BOLD}Usage:${NC}
  bash scripts/prod.sh [command]

${BOLD}Commands:${NC}
  ${GREEN}deploy${NC}   (default)  Pull deps, build frontend, apply migrations, start via PM2
  ${GREEN}build${NC}               Build only — does not restart services
  ${GREEN}restart${NC}             Gracefully restart both PM2 services
  ${GREEN}stop${NC}                Stop PM2 services (Nginx keeps serving 502 until restart)
  ${GREEN}logs${NC}                Tail live logs for both services
  ${GREEN}status${NC}              PM2 status + backend health check
  ${GREEN}migrate${NC}             Apply Alembic migrations only
  ${GREEN}help${NC}                Show this message

${BOLD}Environment overrides:${NC}
  PROJECT_NAME=lms2 BACKEND_PORT=8002 FRONTEND_PORT=3002 DOMAIN=lms2.example.com bash scripts/prod.sh

${BOLD}Quick checklist:${NC}
  1. Set up Nginx + SSL once:  sudo certbot --nginx -d ${DOMAIN}
  2. Deploy app:               bash scripts/prod.sh
  3. On every update:          git pull && bash scripts/prod.sh restart
     (or full rebuild):        git pull && bash scripts/prod.sh deploy

${BOLD}Logs location:${NC}
  $LOGS_DIR/backend-out.log
  $LOGS_DIR/backend-error.log
  $LOGS_DIR/frontend-out.log
  $LOGS_DIR/frontend-error.log

EOF
}

# ── Entrypoint ────────────────────────────────────────────────
main() {
  local cmd="${1:-deploy}"
  case "$cmd" in
    help|--help|-h) cmd_help; exit 0 ;;
    *) preflight ;;
  esac

  case "$cmd" in
    deploy)  cmd_deploy  ;;
    build)   cmd_build   ;;
    restart) cmd_restart ;;
    stop)    cmd_stop    ;;
    logs)    cmd_logs    ;;
    status)  cmd_status  ;;
    migrate) cmd_migrate ;;
    *)       warn "Unknown command: $cmd"; cmd_help ;;
  esac
}

main "$@"
