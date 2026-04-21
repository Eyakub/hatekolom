# Happy Baby — Production Deployment Guide

Two deployment options: **Docker** (isolated, heavier) or **Bare Metal** (lightweight, multiple projects on one server).

| | Docker | Bare Metal |
|--|--------|-----------|
| Disk usage | ~3-4 GB | ~500 MB |
| RAM usage | ~800 MB | ~400 MB |
| Projects per 1GB VPS | 1 | 2-3 |
| Setup | 1 command | 3 scripts |

---

## Common: Clone & Configure

```bash
git clone <your-repo-url> /opt/lms
cd /opt/lms

# Create production env file
cp backend/.env.prod.example backend/.env.prod
nano backend/.env.prod   # Fill all values!
```

### Required .env.prod values:
```
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(64))">
JWT_SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(64))">
VIDEO_SIGNING_SECRET=<generate: python3 -c "import secrets; print(secrets.token_urlsafe(32))">
SUPERADMIN_PHONE=<your phone>
SUPERADMIN_PASSWORD=<strong password>
CORS_ORIGINS=["https://yourdomain.com"]
```

---

# Option A — Docker Deployment

### Prerequisites
- Ubuntu 22.04+ with Docker & Docker Compose

### 1. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP → redirects to HTTPS
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
# NEVER expose 5432 (PostgreSQL) or 6379 (Redis)
```

### 2. SSL Certificate

```bash
export DOMAIN=yourdomain.com
chmod +x scripts/ssl-init.sh
./scripts/ssl-init.sh yourdomain.com admin@yourdomain.com

# Update nginx config
sed -i "s/\${DOMAIN}/yourdomain.com/g" nginx/nginx.conf
```

### 3. Deploy

```bash
export POSTGRES_PASSWORD=<strong-db-password>
export REDIS_PASSWORD=<strong-redis-password>
export POSTGRES_USER=lms_user
export POSTGRES_DB=lms_db
export DOMAIN=yourdomain.com

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Verify
curl https://yourdomain.com/health
```

### 4. Database Backups (Docker)

Runs automatically every 24 hours via the `db-backup` sidecar container.
- Location: `./backups/`
- Retention: 7 days

```bash
# Manual backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U lms_user lms_db | gzip > backups/manual_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backups/lms_backup_20260401.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U lms_user lms_db
```

### 5. SSL Renewal (Docker)

Auto-renews via `certbot` container. Manual:

```bash
docker compose -f docker-compose.prod.yml exec certbot certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

### 6. Logs & Updates (Docker)

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f backend

# Update
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

# Option B — Bare Metal Deployment (Recommended for small servers)

### Prerequisites
- Ubuntu 22.04+ (no Docker needed)

### 1. Server Setup (one time)

Installs PostgreSQL 16, Redis, Python 3, Node.js 20, Nginx, certbot, and configures UFW.

```bash
export DB_PASSWORD=<strong-db-password>
export REDIS_PASSWORD=<strong-redis-password>

sudo -E bash scripts/server-setup.sh
```

### 2. Deploy

Creates Python venv, installs deps, builds Next.js, sets up systemd services, configures Nginx.

```bash
sudo bash scripts/deploy-bare.sh
```

This creates two systemd services:
- `lms-backend` — Gunicorn + Uvicorn (port 8000)
- `lms-frontend` — Next.js standalone (port 3000)

### 3. SSL Certificate

```bash
sudo bash scripts/ssl-bare.sh yourdomain.com admin@yourdomain.com
```

Uses certbot's nginx plugin — one command, auto-renewal included.

### 4. Database Backups (bare metal)

Add a cron job (runs daily at 3 AM):

```bash
sudo crontab -e
# Add this line:
0 3 * * * /opt/lms/scripts/backup-bare.sh
```

- Location: `/opt/lms/backups/`
- Retention: 7 days
- Format: `lms_backup_YYYYMMDD_HHMMSS.sql.gz`

```bash
# Manual backup
sudo -u postgres pg_dump lms_db | gzip > /opt/lms/backups/manual_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c /opt/lms/backups/lms_backup_20260401.sql.gz | sudo -u postgres psql lms_db
```

### 5. Managing Services

```bash
# Status
sudo systemctl status lms-backend
sudo systemctl status lms-frontend

# Restart
sudo systemctl restart lms-backend
sudo systemctl restart lms-frontend

# Logs (live)
journalctl -u lms-backend -f
journalctl -u lms-frontend -f

# Backend error log
tail -f /var/log/lms/backend-error.log
```

### 6. Updates (bare metal)

```bash
cd /opt/lms
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
deactivate
sudo systemctl restart lms-backend

# Frontend
cd ../frontend
npm ci && npm run build
sudo systemctl restart lms-frontend
```

---

# Monitoring

### Health check:
```bash
curl -s https://yourdomain.com/health | python3 -m json.tool
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-04-02T00:00:00+00:00",
  "checks": {
    "db": "healthy",
    "redis": "healthy"
  }
}
```

---

# Running Tests

```bash
cd backend
source venv/bin/activate   # bare metal only
pip install -r requirements.txt
pytest -v
```

---

# Security Checklist

- [ ] `DEBUG=false` in production .env
- [ ] Strong `SECRET_KEY` and `JWT_SECRET_KEY` (64+ chars)
- [ ] PostgreSQL port 5432 NOT exposed
- [ ] Redis port 6379 NOT exposed
- [ ] UFW enabled with only 22, 80, 443 open
- [ ] `.env.prod` NOT committed to git
- [ ] CORS_ORIGINS set to production domain only
- [ ] SSLCOMMERZ_SANDBOX=false with real credentials
- [ ] SMS_MOCK=false with real API key
