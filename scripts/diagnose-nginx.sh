#!/usr/bin/env bash
# Run this on the server to diagnose the subdomain redirect issue:
# bash scripts/diagnose-nginx.sh

echo "=== NGINX CONFIGS IN sites-enabled ==="
ls -la /etc/nginx/sites-enabled/

echo ""
echo "=== LMS NGINX CONFIG ==="
cat /etc/nginx/sites-available/lms 2>/dev/null || echo "FILE NOT FOUND"

echo ""
echo "=== MAIN DOMAIN NGINX CONFIG ==="
# Find which config handles attirethreadsbd.com
grep -rl "attirethreadsbd.com" /etc/nginx/sites-enabled/ 2>/dev/null | while read f; do
  echo "--- $f ---"
  cat "$f"
done

echo ""
echo "=== CERTBOT CERTIFICATES ==="
sudo certbot certificates 2>/dev/null || echo "certbot not found"

echo ""
echo "=== NGINX TEST ==="
sudo nginx -t

echo ""
echo "=== CURL TEST (what lms subdomain returns) ==="
curl -I http://lms.attirethreadsbd.com 2>/dev/null | head -20
