#!/bin/bash
# ============================================
# Database Backup — Bare Metal (cron job)
# ============================================
# Install: sudo crontab -e
# Add:     0 3 * * * /opt/lms/scripts/backup-bare.sh
# (runs daily at 3 AM)
# ============================================

set -euo pipefail

BACKUP_DIR="/opt/lms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="lms_backup_${DATE}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup..."

# Dump and compress
sudo -u postgres pg_dump lms_db | gzip > "${BACKUP_DIR}/${FILENAME}"

if [ -f "${BACKUP_DIR}/${FILENAME}" ]; then
    SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
    echo "[$(date)] ✓ Backup: ${FILENAME} (${SIZE})"
else
    echo "[$(date)] ✗ Backup FAILED"
    exit 1
fi

# Keep only last 7 days
find "${BACKUP_DIR}" -name "lms_backup_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Cleanup done."
