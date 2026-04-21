# Hate Kolom

> **Play, Learn, Grow** — a Bengali-first educational platform for kids (ages 3–13), managed by parents. Built with **FastAPI**, **Next.js 16**, **PostgreSQL 16**, and **Redis 7**.

---

## 🚀 Quick Start

### Option A: Native Setup (Recommended)

1. **Initialize the App**
   ```bash
   git clone <repo-url> hatekolom
   cd hatekolom
   # Automatically sets up Python venv, installs Node deps, syncs the DB, and runs servers natively
   bash scripts/dev.sh
   ```

2. **Seed Demo Data** (Optional)
   *In a new terminal window:*
   ```bash
   cd backend
   source venv/bin/activate
   python seed.py
   ```

   *Services will be available at:*
   * Frontend: http://localhost:3001
   * Backend API: http://localhost:8001
   * API Docs: http://localhost:8001/docs

### Option B: Docker Setup

1. **Start all services**
   ```bash
   git clone <repo-url> hatekolom
   cd hatekolom
   docker compose up --build -d
   ```

2. **Seed Demo Data** (Optional)
   ```bash
   docker compose exec backend python seed.py
   ```

   *Services will be available at:*
   * Frontend: http://localhost:3000
   * Backend API: http://localhost:8000
   * API Docs: http://localhost:8000/docs

### Default Superadmin
| Field | Value |
|-------|-------|
| Phone | `01700000000` |
| Password | `admin123` |

> ⚠️ Change this immediately after first login!

---

## 🏗 Architecture

```
hatekolom/
├── backend/                  # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── api/v1/           # Route handlers
│   │   ├── core/             # Config, security, permissions, middleware
│   │   ├── db/               # SQLAlchemy async engine + Base
│   │   ├── models/           # 20+ database models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Business logic
│   │       ├── entitlement_service.py  # Purchase → entitlement engine
│   │       ├── payment_service.py      # Mock payment (Phase 1)
│   │       ├── shipping_service.py     # State machine (FSM)
│   │       ├── video_service.py        # Signed embeds + heartbeat
│   │       ├── ebook_service.py        # B2 presigned downloads
│   │       └── progress_service.py     # Per-child lesson tracking
│   ├── alembic/              # Database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/                 # Next.js 16 (React 19, Tailwind v4)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Homepage
│   │   │   ├── login/                # Phone + password login
│   │   │   ├── register/             # Parent registration
│   │   │   ├── courses/              # Listing + [slug] detail
│   │   │   ├── dashboard/            # Parent dashboard
│   │   │   ├── learn/[courseId]/      # Course content player
│   │   │   ├── checkout/             # Order + payment
│   │   │   └── admin/                # Admin panel
│   │   ├── components/
│   │   │   ├── layout/               # Navbar, Footer
│   │   │   ├── video/                # SecureVideoPlayer
│   │   │   ├── course/               # CourseAccordion, ProgressBar
│   │   │   └── ebook/                # EbookLibrary
│   │   ├── stores/                   # Zustand auth store
│   │   └── lib/                      # API client
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## 📡 API Endpoints

| Group | Endpoints | Auth |
|-------|-----------|------|
| **Auth** | `POST /register`, `POST /login`, `POST /refresh`, `GET /me` | Public / Bearer |
| **Children** | `CRUD /children/` | Bearer (parent) |
| **Categories** | `CRUD /categories/` | Public / Admin |
| **Courses** | `GET /courses/`, `GET /courses/{id}`, `POST /courses/` | Public / Admin |
| **Modules** | `POST /courses/{id}/modules`, `PATCH /modules/{id}` | Admin |
| **Lessons** | `POST /modules/{id}/lessons`, `PATCH /lessons/{id}` | Admin |
| **Orders** | `POST /orders/`, `GET /orders/my`, `GET /orders/` | Bearer / Admin |
| **Shipments** | `GET /shipments/`, `PATCH /shipments/{id}` | Admin |
| **Video** | `POST /video/access`, `POST /video/heartbeat` | Bearer |
| **Ebooks** | `GET /ebooks/my`, `POST /ebooks/{id}/download` | Bearer |
| **Progress** | `GET /progress/children/{id}/courses/{id}`, `POST /progress/update` | Bearer |

---

## 🔐 Security

| Layer | Implementation |
|-------|---------------|
| **Auth** | JWT (access + refresh tokens) |
| **RBAC** | 6 roles: super_admin, admin, instructor, moderator, parent, student |
| **Rate Limiting** | Redis-based, per-IP (10/min for auth, 100/min general) |
| **Video Anti-Piracy** | Signed embeds + dynamic watermark + concurrent session limit |
| **Ebook Downloads** | B2 presigned URLs (5min TTL) + 3/day rate limit + audit trail |
| **DB Ports** | Not exposed in production compose |

---

## 🗄 Database Migrations

### Native

```bash
cd backend
source venv/bin/activate

# Generate a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

### Docker

```bash
# Generate a new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# Rollback one step
docker compose exec backend alembic downgrade -1
```

---

## 🛠 Development

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild after dependency changes
docker compose up --build -d

# Access PostgreSQL
docker compose exec db psql -U hatekolom_user -d hatekolom_db
```

---

## 🚢 Production Deployment

### Option A: Native Bare-Metal (Ubuntu 24.04 LTS)

We provide robust, automated bash scripts to configure a fresh Ubuntu droplet and deploy natively using PM2 and Nginx.

1. **Server Bootstrapping (Run as root)**
   On a brand new DigitalOcean/AWS instance, execute:
   ```bash
   curl -sSL https://raw.githubusercontent.com/<user>/<repo>/main/scripts/server-setup.sh | bash
   ```
   *(This fully installs PostgreSQL, Redis, Python 3.12, Node.js 22, PM2, Nginx, UFW, and Fail2ban)*

2. **Configure & Deploy (Run as 'eyakub')**
   SSH into the server as the standard user, clone the repo, specify secrets, and run:
   ```bash
   cp backend/.env.prod.example backend/.env.prod  # Fill in real keys!
   bash scripts/deploy.sh
   ```

3. **Enable SSL (HTTPS) — ⚠️ CRITICAL STEP**
   You **must** run the SSL generator immediately. If you skip this, Nginx will not open port 443 for the LMS, and your HTTPS traffic will visually collide/fallback into other apps on your server (e.g. other setups)!
   ```bash
   sudo bash scripts/ssl.sh yourdomain.com admin@email.com
   ```

### Option B: Docker Compose

1. Copy `backend/.env.example` → `backend/.env` and fill in real values
2. Generate strong secrets for `.env.prod`:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))" # SECRET_KEY
   python -c "import secrets; print(secrets.token_urlsafe(32))" # VIDEO_SIGNING_SECRET
   ```
3. Update `CORS_ORIGINS` to your production domain
4. Use Nginx proxy and start the production Compose file:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

---

## 📋 License

Proprietary. All rights reserved.
