#!/bin/bash
# ============================================
# SSL Setup — Bare Metal (Certbot + Nginx)
# ============================================
# Usage: sudo bash scripts/ssl-bare.sh yourdomain.com admin@email.com
# ============================================

set -euo pipefail

DOMAIN=${1:?"Usage: ./ssl-bare.sh yourdomain.com admin@email.com"}
EMAIL=${2:?"Usage: ./ssl-bare.sh yourdomain.com admin@email.com"}
PROJECT_NAME="${PROJECT_NAME:-lms}"

echo "=== Setting up SSL for ${DOMAIN} ==="

# Update Nginx server_name
NGINX_SITE="/etc/nginx/sites-available/${PROJECT_NAME}"
if [[ ! -f "$NGINX_SITE" ]]; then
  echo "ERROR: Nginx config not found at ${NGINX_SITE}"
  echo "Run deploy.sh first, or set PROJECT_NAME env var"
  exit 1
fi
sed -i "s/server_name .*;/server_name ${DOMAIN};/" "$NGINX_SITE"
nginx -t && systemctl reload nginx

# Get certificate via certbot
certbot --nginx -d "${DOMAIN}" --email "${EMAIL}" --agree-tos --no-eff-email --redirect

# Auto-renewal is already set up by certbot (systemd timer)
echo ""
echo "=== SSL setup complete! ==="
echo "Your site is live at: https://${DOMAIN}"
echo ""
echo "Certificate auto-renews via: systemctl list-timers certbot.timer"
