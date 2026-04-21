# Prompt for DevOps Scripts Generation

*You can copy and paste the prompt below into ChatGPT, Claude, or any AI assistant for your other project to get exactly similar deployment and orchestration scripts.*

***

**Please act as an expert DevOps and Full-Stack Systems Engineer.**

I have a full-stack project utilizing the following stack:
- **Backend:** FastAPI (Python), SQLAlchemy, Alembic
- **Frontend:** Next.js (React), Typescript, TailwindCSS
- **Database Layer:** PostgreSQL and Redis
- **Production Paradigm:** Native App / Process Management via **PM2**, Nginx, no Docker wrappers (bare-metal approach).

I need you to generate four robust shell scripts inside a `scripts/` directory similar to my established native workflow. Ensure they feature beautiful terminal color-logging (e.g., green `[OK]`, yellow `[WARN]`, red `[ERROR]`), informative outputs, and strict `set -euo pipefail` safety measures.

Here are the specific requirements for each script:

### 1. `dev.sh` (Local Development Orchestrator)
**Purpose:** Fully orchestrate the local system for native development on Mac or Linux.
- Detect the OS. Make sure PostgreSQL and Redis are installed/running using Native Package Managers (Homebrew for macOS / apt or dnf for Linux).
- Setup the Python `.venv` in the backend folder, activate it, and run `pip install -e '.[dev]'`.
- Establish env variables for local dev (Database URLs, Redis URL, CORS).
- Run `alembic upgrade head` to ensure the local DB is synced.
- Start the FastAPI application with `uvicorn app.main:app` (default port 8000).
- Run `npm install` and `npm run dev` in the frontend (default port 3000).
- Stream all outputs from Redis, FastAPI, and Next.js into a single terminal window with colored command-line prefixes (e.g. `[BACKEND]`, `[FRONTEND]`, `[REDIS]`).
- Trap `Ctrl+C` to cleanly kill all child processes. 
- The script must support `--no-frontend` or `--no-backend` args to selectively launch layers.

### 2. `server-setup.sh` (Pristine VPS Bootstrap)
**Purpose:** Prepare a brand-new Ubuntu 24.04 LTS droplet/server. (To be run ONCE as `root`).
- Upgrade all system packages.
- Create a non-root developer user with `sudo` access based on a variable. Configure SSH limits (key-based auth only, no root password login, max retries).
- Establish UFW Firewall to only allow `22/tcp` (SSH), `80/tcp` (HTTP), `443/tcp` (HTTPS).
- Assign a 2GB swap memory file tuned with `swappiness=10` to prevent node-build OOM kills.
- Install native `PostgreSQL 16` and configure it to listen on `localhost` only (`md5` password auth setup).
- Install native `Redis 7` bounded to `localhost`.
- Install `Python 3.12` and Native `Node.js 22 LTS`. 
- Globally install `PM2` via npm and configure it to start on boot for the dev user.
- Install Nginx, Certbot (Let's encrypt), Fail2Ban (preconfigured for SSH & Nginx), and Unattended Security Upgrades.

### 3. `deploy.sh` (also aliased as `prod.sh`)
**Purpose:** Automate native production deployments with zero downtime via PM2. (To be run by the non-root developer user).
- **Structure:** Process commands like `deploy` (default), `restart`, `stop`, `logs`, `status`, and `migrate`.
- **Backend Build:** Setup python `.venv`, update pip, install dependencies natively.
- **DB Migration:** Source `.env.prod` secrets and run `alembic upgrade head`.
- **Frontend Build:** Run `npm ci` and `npm run build`. If using Next.js standalone, copy `public` and `.next/static` assets into the standalone directory.
- **Ecosystem Execution:** Load a dynamic PM2 ecosystem config or spawn `pm2 start...` safely for backend and frontend. Keep names dynamic based on an environment `PROJECT_NAME` variable to support multi-tenancy.

### 4. `db_backup.sh`
**Purpose:** Securely create and manage PostgreSQL database dumps natively.
- Load PostgreSQL credentials safely from environment variables (e.g., `PGUSER`, `PGDATABASE`).
- Run `pg_dump` and instantly pipe it to `gzip` to compress the SQL payload. Add a clear timestamp to the filename (e.g. `backup_YYYYMMDD_HHMMSS.sql.gz`).
- Target a dedicated root-safe or user backup folder (e.g., `/backups` or `~/backups`).
- Include standard logging with exact timestamp footprints (`[YYYY-MM-DD HH:MM:SS] Starting backup...`).
- Utilize the `find` command to delete backup files older than 7 days, maintaining a clean rolling retention window without cluttering disk space.

**Output instructions:** Provide the four complete, functional bash scripts properly commented out. Use `#!/usr/bin/env bash` declarations, ensure standard helper functions for logging, and follow clean coding architectural principles.
