#!/bin/bash
# ============================================
# Happy Baby — Bare Metal Deploy Script
# Run after server-setup.sh
# ============================================
# Usage: sudo bash scripts/deploy-bare.sh
# ============================================

set -euo pipefail

APP_DIR="/opt/lms"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"

echo "=== Happy Baby — Deploying ==="

# ─── 1. Backend Setup ───────────────────────
echo "[1/4] Setting up backend..."

cd "${BACKEND_DIR}"

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Run migrations
alembic upgrade head

deactivate
echo "  ✓ Backend ready"

# ─── 2. Frontend Setup ──────────────────────
echo "[2/4] Building frontend..."

cd "${FRONTEND_DIR}"
npm ci
npm run build
echo "  ✓ Frontend built"

# ─── 3. Create Systemd Services ─────────────
echo "[3/4] Creating systemd services..."

# Backend service (Gunicorn + Uvicorn workers)
cat > /etc/systemd/system/lms-backend.service << EOF
[Unit]
Description=LMS Backend (FastAPI)
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${BACKEND_DIR}
Environment="PATH=${BACKEND_DIR}/venv/bin"
EnvironmentFile=${BACKEND_DIR}/.env.prod
ExecStart=${BACKEND_DIR}/venv/bin/gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind 127.0.0.1:8000 \
    --access-logfile /var/log/lms/backend-access.log \
    --error-logfile /var/log/lms/backend-error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (Next.js production)
cat > /etc/systemd/system/lms-frontend.service << EOF
[Unit]
Description=LMS Frontend (Next.js)
After=network.target lms-backend.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${FRONTEND_DIR}
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="NEXT_PUBLIC_API_URL=https://\$(hostname -f)/api/v1"
ExecStart=/usr/bin/node ${FRONTEND_DIR}/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
mkdir -p /var/log/lms
chown www-data:www-data /var/log/lms

# Set ownership
chown -R www-data:www-data "${APP_DIR}"

# Enable and start services
systemctl daemon-reload
systemctl enable lms-backend lms-frontend
systemctl start lms-backend
systemctl start lms-frontend

echo "  ✓ Services running"

# ─── 4. Setup Nginx ─────────────────────────
echo "[4/4] Configuring Nginx..."

cat > /etc/nginx/sites-available/lms << 'EOF'
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    client_max_body_size 100M;

    # API → Backend (port 8000)
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /api/v1/auth/ {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }

    # Static uploads
    location /static/ {
        proxy_pass http://127.0.0.1:8000;
        expires 7d;
    }

    # Frontend → Next.js (port 3000)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/lms
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "  ✓ Nginx configured"

echo ""
echo "=== Deployment complete! ==="
echo ""
echo "Services:"
echo "  systemctl status lms-backend"
echo "  systemctl status lms-frontend"
echo ""
echo "Logs:"
echo "  journalctl -u lms-backend -f"
echo "  journalctl -u lms-frontend -f"
echo ""
echo "Next: Run scripts/ssl-bare.sh for HTTPS"
