#!/bin/bash
# ============================================
# SSL Certificate Init Script
# Run ONCE on a new server to get initial certs
# ============================================

set -euo pipefail

DOMAIN=${1:?"Usage: ./ssl-init.sh yourdomain.com"}
EMAIL=${2:?"Usage: ./ssl-init.sh yourdomain.com admin@yourdomain.com"}

echo "=== LMS SSL Certificate Setup ==="
echo "Domain: ${DOMAIN}"
echo "Email:  ${EMAIL}"
echo ""

# Step 1: Create directories
mkdir -p certbot/conf certbot/www

# Step 2: Start nginx with HTTP only (for ACME challenge)
echo "Starting Nginx (HTTP only)..."
# Temporarily use a simple HTTP config for cert issuance
cat > nginx/nginx-temp.conf << 'EOF'
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name _;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'Happy Baby - Setting up SSL...';
            add_header Content-Type text/plain;
        }
    }
}
EOF

docker run -d --name lms-nginx-temp \
    -p 80:80 \
    -v "$(pwd)/nginx/nginx-temp.conf:/etc/nginx/nginx.conf:ro" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    nginx:alpine

# Step 3: Get certificate
echo "Requesting SSL certificate..."
docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email

# Step 4: Cleanup temp nginx
docker stop lms-nginx-temp && docker rm lms-nginx-temp
rm -f nginx/nginx-temp.conf

echo ""
echo "=== SSL setup complete! ==="
echo "Certificate location: certbot/conf/live/${DOMAIN}/"
echo ""
echo "Next steps:"
echo "  1. Update nginx/nginx.conf: replace \${DOMAIN} with ${DOMAIN}"
echo "  2. Set DOMAIN=${DOMAIN} in your .env"
echo "  3. Run: docker compose -f docker-compose.prod.yml up -d --build"
