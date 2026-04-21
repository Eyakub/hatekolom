#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  server-setup.sh  –  Fresh Ubuntu 24.04 LTS Droplet Bootstrap
#  Run ONCE as root on a brand-new DigitalOcean droplet.
#
#  What it does:
#    1. System update + essential packages
#    2. Creates 'eyakub' user with sudo + SSH key
#    3. SSH hardening (disable root login, password auth, key-only)
#    4. UFW firewall (only SSH, HTTP, HTTPS open)
#    5. 2GB swap file (prevents OOM during npm builds)
#    6. PostgreSQL 16
#    7. Redis 7
#    8. Python 3.12 + pip + venv
#    9. Node.js 22 LTS + PM2
#   10. Nginx + Certbot (Let's Encrypt SSL)
#   11. Fail2ban (SSH + Nginx brute-force protection)
#   12. Unattended security upgrades
#   13. Project directory structure
#
#  Usage (as root):
#    curl -sSL https://raw.githubusercontent.com/.../server-setup.sh | bash
#    # — or —
#    scp server-setup.sh root@YOUR_IP:~ && ssh root@YOUR_IP bash server-setup.sh
#
#  After running:
#    1. Open a NEW terminal, confirm: ssh eyakub@YOUR_IP
#    2. Only THEN close the root session
#    3. Clone your project(s) and run ./scripts/deploy.sh
#
#  DBeaver: connect via SSH tunnel (eyakub@IP → localhost:5432)
#  Ports 5432/6379 are NOT exposed — this is intentional.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m';   GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';     NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Must run as root ─────────────────────────────────────────
[[ "$(id -u)" -eq 0 ]] || die "Run this script as root"

# ── Config ───────────────────────────────────────────────────
USERNAME="eyakub"
SWAP_SIZE="2G"
NODE_MAJOR=22
PG_VERSION=16

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Hate Kolom — Fresh Server Setup — Ubuntu 24.04 LTS${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""

# ═════════════════════════════════════════════════════════════
# 1. System Update
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 1. System Update ────────────────────────────────────${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git build-essential software-properties-common \
  apt-transport-https ca-certificates gnupg lsb-release \
  htop tmux unzip jq
success "System packages updated"

# ═════════════════════════════════════════════════════════════
# 2. Create User
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 2. Create User: ${USERNAME} ─────────────────────────${NC}"
if id "$USERNAME" &>/dev/null; then
  success "User '$USERNAME' already exists"
else
  info "Creating user '$USERNAME' — you'll be prompted for a password"
  adduser "$USERNAME"
  usermod -aG sudo "$USERNAME"
  success "User '$USERNAME' created with sudo (password required for sudo)"
fi

# Copy SSH keys from root
if [[ -f /root/.ssh/authorized_keys ]]; then
  mkdir -p "/home/${USERNAME}/.ssh"
  cp /root/.ssh/authorized_keys "/home/${USERNAME}/.ssh/"
  chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}/.ssh"
  chmod 700 "/home/${USERNAME}/.ssh"
  chmod 600 "/home/${USERNAME}/.ssh/authorized_keys"
  success "SSH keys copied to ${USERNAME}"
else
  warn "No SSH keys found at /root/.ssh/authorized_keys"
  warn "You'll need to manually add keys for ${USERNAME}"
fi

# ═════════════════════════════════════════════════════════════
# 3. SSH Hardening
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 3. SSH Hardening ────────────────────────────────────${NC}"
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'SSH_CONF'
# ── LMS server hardening ──
PasswordAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
AllowAgentForwarding no
# AllowTcpForwarding must stay 'yes' for DBeaver SSH tunnels
AllowTcpForwarding yes
SSH_CONF

# Ensure privilege separation directory exists (required by sshd -t on Ubuntu 24.04)
mkdir -p /run/sshd

# Validate config before reloading
sshd -t || die "SSH config test failed — fix /etc/ssh/sshd_config.d/99-hardening.conf"
systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || warn "Could not reload SSH — restart manually"
success "SSH hardened (key-only, root via console only, TCP forwarding for DBeaver)"

# ═════════════════════════════════════════════════════════════
# 4. UFW Firewall
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 4. UFW Firewall ─────────────────────────────────────${NC}"
if ufw status | grep -q "active"; then
  success "UFW already active"
else
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp comment "SSH"
  ufw allow 80/tcp comment "HTTP"
  ufw allow 443/tcp comment "HTTPS"
  ufw --force enable
fi
ufw status verbose
success "UFW active — only SSH(22), HTTP(80), HTTPS(443) open"
warn "Ports 5432 (Postgres) and 6379 (Redis) are blocked externally"
info "Use DBeaver via SSH tunnel: ${USERNAME}@server → localhost:5432"

# ═════════════════════════════════════════════════════════════
# 5. Swap File
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 5. Swap File (${SWAP_SIZE}) ─────────────────────────${NC}"
if swapon --show | grep -q "/swapfile"; then
  success "Swap already configured"
else
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  # Tune swappiness for a server (low = prefer RAM over swap)
  sysctl vm.swappiness=10
  echo "vm.swappiness=10" >> /etc/sysctl.conf
  success "Swap ${SWAP_SIZE} created and active"
fi

# ═════════════════════════════════════════════════════════════
# 6. PostgreSQL 16
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 6. PostgreSQL ${PG_VERSION} ─────────────────────────${NC}"
if command -v psql &>/dev/null && psql --version | grep -q "${PG_VERSION}"; then
  success "PostgreSQL ${PG_VERSION} already installed"
else
  # Official PostgreSQL APT repo (modern gpg keyring method)
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/keyrings/postgresql-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/postgresql-archive-keyring.gpg] \
    https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"
  success "PostgreSQL ${PG_VERSION} installed"
fi

# Ensure service is running
systemctl enable postgresql
systemctl start postgresql
success "PostgreSQL service running"

# Configure: listen on localhost only (security)
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

if grep -q "^listen_addresses" "$PG_CONF"; then
  sed -i "s/^listen_addresses.*/listen_addresses = 'localhost'/" "$PG_CONF"
else
  echo "listen_addresses = 'localhost'" >> "$PG_CONF"
fi

# Allow local connections with password (md5) for app users
if ! grep -q "local.*all.*all.*md5" "$PG_HBA"; then
  sed -i '/^# IPv4 local connections:/a host    all             all             127.0.0.1/32            md5' "$PG_HBA"
fi

systemctl restart postgresql
success "PostgreSQL configured (localhost only, md5 auth)"

# Create the eyakub DB superuser for managing all project databases
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${USERNAME}'" | grep -q 1; then
  success "PostgreSQL user '${USERNAME}' already exists"
else
  sudo -u postgres createuser --superuser "$USERNAME"
  info "PostgreSQL superuser '${USERNAME}' created"
  info "Set a password: sudo -u postgres psql -c \"ALTER USER ${USERNAME} PASSWORD 'YOUR_SECRET';\""
fi
info "Project databases will be created by each project's deploy.sh script"

# ═════════════════════════════════════════════════════════════
# 7. Redis 7
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 7. Redis ────────────────────────────────────────────${NC}"
if command -v redis-server &>/dev/null; then
  success "Redis already installed"
else
  apt-get install -y -qq redis-server
  success "Redis installed"
fi

# Harden Redis: localhost only, no external access
REDIS_CONF="/etc/redis/redis.conf"
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' "$REDIS_CONF"
sed -i 's/^protected-mode .*/protected-mode yes/' "$REDIS_CONF"

# Set Redis password if provided (matches REDIS_URL in .env.prod)
if [[ -n "${REDIS_PASSWORD:-}" ]]; then
  sed -i "s/^# requirepass foobared/requirepass ${REDIS_PASSWORD}/" "$REDIS_CONF"
  if ! grep -q "^requirepass" "$REDIS_CONF"; then
    echo "requirepass ${REDIS_PASSWORD}" >> "$REDIS_CONF"
  fi
  success "Redis password configured"
else
  warn "No REDIS_PASSWORD set — Redis accessible without password (localhost only)"
  info "To set later: edit /etc/redis/redis.conf → requirepass your_password"
fi

# Memory limit — reasonable for 2GB droplet
sed -i 's/^# maxmemory .*/maxmemory 256mb/' "$REDIS_CONF"
if ! grep -q "^maxmemory " "$REDIS_CONF"; then
  echo "maxmemory 256mb" >> "$REDIS_CONF"
fi
if ! grep -q "^maxmemory-policy" "$REDIS_CONF"; then
  echo "maxmemory-policy allkeys-lru" >> "$REDIS_CONF"
fi

systemctl enable redis-server
systemctl restart redis-server
redis-cli ping &>/dev/null && success "Redis running on localhost:6379" \
  || die "Redis failed to start"

# ═════════════════════════════════════════════════════════════
# 8. Python 3.12
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 8. Python 3.12 ──────────────────────────────────────${NC}"
# Ubuntu 24.04 ships Python 3.12 natively
if python3 --version 2>/dev/null | grep -q "3.12"; then
  success "Python 3.12 already available"
else
  # Fallback: deadsnakes PPA
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -qq
  apt-get install -y -qq python3.12 python3.12-venv python3.12-dev
  update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
  success "Python 3.12 installed via deadsnakes"
fi

# Ensure pip and venv are available
apt-get install -y -qq python3-pip python3-venv python3-dev
success "Python 3.12 + pip + venv ready"

# ═════════════════════════════════════════════════════════════
# 9. Node.js 22 LTS + PM2
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 9. Node.js ${NODE_MAJOR} + PM2 ─────────────────────${NC}"
if node --version 2>/dev/null | grep -q "v${NODE_MAJOR}"; then
  success "Node.js ${NODE_MAJOR} already installed"
else
  # NodeSource official repo
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  success "Node.js $(node --version) installed"
fi

# PM2 — process manager for production
if command -v pm2 &>/dev/null; then
  success "PM2 already installed"
else
  npm install -g pm2
  success "PM2 $(pm2 --version) installed"
fi

# Setup PM2 to start on boot as eyakub
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USERNAME" --hp "/home/${USERNAME}"
success "PM2 configured to start on boot for ${USERNAME}"

# ═════════════════════════════════════════════════════════════
# 10. Nginx + Certbot
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 10. Nginx + Certbot ─────────────────────────────────${NC}"
if command -v nginx &>/dev/null; then
  success "Nginx already installed"
else
  apt-get install -y -qq nginx
  success "Nginx installed"
fi

# Harden Nginx globally
NGINX_CONF="/etc/nginx/nginx.conf"
if ! grep -q "server_tokens off" "$NGINX_CONF"; then
  sed -i '/http {/a \\n\t# Security hardening\n\tserver_tokens off;\n\n\t# SSL hardening\n\tssl_protocols TLSv1.2 TLSv1.3;\n\tssl_prefer_server_ciphers on;\n\tssl_session_cache shared:SSL:10m;\n\tssl_session_timeout 1d;\n\tssl_session_tickets off;\n\n\t# Rate limiting zones\n\tlimit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;\n\tlimit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;\n\tlimit_req_status 429;' "$NGINX_CONF"
  success "Nginx hardened (server_tokens off, TLS 1.2+, rate limiting)"
fi

# Remove default site
rm -f /etc/nginx/sites-enabled/default

systemctl enable nginx
systemctl restart nginx
success "Nginx running"

# Certbot for Let's Encrypt
if command -v certbot &>/dev/null; then
  success "Certbot already installed"
else
  apt-get install -y -qq certbot python3-certbot-nginx
  success "Certbot installed"
fi
info "To get SSL: certbot --nginx -d yourdomain.com -d www.yourdomain.com"

# ═════════════════════════════════════════════════════════════
# 11. Fail2ban
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 11. Fail2ban ────────────────────────────────────────${NC}"
if command -v fail2ban-client &>/dev/null; then
  success "Fail2ban already installed"
else
  apt-get install -y -qq fail2ban
  success "Fail2ban installed"
fi

# Configure jails
cat > /etc/fail2ban/jail.d/server.conf <<'F2B_CONF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
banaction = ufw

[sshd]
enabled  = true
port     = ssh
maxretry = 3
bantime  = 24h
findtime = 5m

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10
bantime  = 1h

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 5
bantime  = 24h
F2B_CONF

systemctl enable fail2ban
systemctl restart fail2ban
success "Fail2ban active (SSH: 3 tries → 24h ban)"
info "Fail2ban won't block DBeaver — you use SSH keys, not passwords"
info "DBeaver connects via SSH tunnel → localhost:5432 (never touches UFW)"

# ═════════════════════════════════════════════════════════════
# 12. Unattended Security Upgrades
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 12. Unattended Security Upgrades ────────────────────${NC}"
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
success "Automatic security updates enabled"

# ═════════════════════════════════════════════════════════════
# 13. Create Project Directory Structure
# ═════════════════════════════════════════════════════════════
echo -e "\n${BOLD}── 13. Project Directory ───────────────────────────────${NC}"
PROJECT_DIR="/home/${USERNAME}/apps"
mkdir -p "$PROJECT_DIR"
chown "${USERNAME}:${USERNAME}" "$PROJECT_DIR"
success "Project directory: ${PROJECT_DIR}"
info "Clone projects here: git clone <repo> ${PROJECT_DIR}/<project-name>"

# ═════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Hate Kolom — Server Setup Complete!${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Installed:${NC}"
echo -e "  • Ubuntu 24.04 — updated & hardened"
echo -e "  • User: ${GREEN}${USERNAME}${NC} (sudo, SSH key-only)"
echo -e "  • PostgreSQL ${PG_VERSION} — localhost:5432"
echo -e "  • Redis 7 — localhost:6379"
echo -e "  • Python $(python3 --version 2>&1 | awk '{print $2}')"
echo -e "  • Node.js $(node --version)"
echo -e "  • PM2 $(pm2 --version)"
echo -e "  • Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"
echo -e "  • Certbot (Let's Encrypt)"
echo -e "  • Fail2ban — SSH + Nginx protection"
echo -e "  • Swap: ${SWAP_SIZE}"
echo ""
echo -e "${BOLD}Database:${NC}"
echo -e "  • Superuser: ${GREEN}${USERNAME}${NC}"
echo -e "  • ⚠️  Set password: sudo -u postgres psql -c \"ALTER USER ${USERNAME} PASSWORD 'secure_pw';\""
echo -e "  • Project DBs are created by each project's ${GREEN}deploy.sh${NC}"
echo ""
echo -e "${BOLD}Firewall (UFW):${NC}"
echo -e "  ✅ 22/tcp  (SSH)"
echo -e "  ✅ 80/tcp  (HTTP)"
echo -e "  ✅ 443/tcp (HTTPS)"
echo -e "  🔒 5432    (Postgres — use SSH tunnel)"
echo -e "  🔒 6379    (Redis — localhost only)"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo -e "  ${CYAN}1.${NC} Open a ${BOLD}NEW${NC} terminal and test: ${GREEN}ssh ${USERNAME}@$(curl -sf ifconfig.me || echo 'YOUR_IP')${NC}"
echo -e "  ${CYAN}2.${NC} Only after confirming SSH works, close this root session"
echo -e "  ${CYAN}3.${NC} Set a Postgres password:"
echo -e "     ${GREEN}sudo -u postgres psql -c \"ALTER USER ${USERNAME} PASSWORD 'your_secure_password';\"${NC}"
echo -e "  ${CYAN}4.${NC} Clone the LMS project:"
echo -e "     ${GREEN}cd ~/apps && git clone <repo> hatekolom${NC}"
echo -e "  ${CYAN}5.${NC} Deploy:"
echo -e "     ${GREEN}cd ~/apps/hatekolom && bash scripts/deploy.sh${NC}"
echo -e "  ${CYAN}6.${NC} Set up SSL:"
echo -e "     ${GREEN}sudo bash scripts/ssl.sh yourdomain.com admin@email.com${NC}"
echo ""
echo -e "${BOLD}DBeaver Connection:${NC}"
echo -e "  Type:       PostgreSQL"
echo -e "  SSH Tunnel: ${USERNAME}@server_ip:22"
echo -e "  Host:       localhost"
echo -e "  Port:       5432"
echo -e "  User:       ${USERNAME}"
echo ""
