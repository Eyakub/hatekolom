#!/bin/bash
# ============================================
# LMS Database Backup Script
# Runs daily via docker-compose db-backup service
# Keeps last 7 days of backups
# ============================================

set -euo pipefail

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="lms_backup_${DATE}.sql.gz"

echo "[$(date)] Starting database backup..."

# Dump and compress
pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" | gzip > "${BACKUP_DIR}/${FILENAME}"

# Check if backup was created successfully
if [ -f "${BACKUP_DIR}/${FILENAME}" ]; then
    SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
    echo "[$(date)] Backup completed: ${FILENAME} (${SIZE})"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# Cleanup: keep only last 7 days
find "${BACKUP_DIR}" -name "lms_backup_*.sql.gz" -type f -mtime +7 -delete
REMAINING=$(ls -1 "${BACKUP_DIR}"/lms_backup_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Cleanup done. ${REMAINING} backups retained."
