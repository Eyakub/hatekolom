#!/bin/sh
set -e

echo "=== LMS Backend Starting ==="

# Run Alembic migrations
echo "Running database migrations..."
alembic upgrade head 2>/dev/null || echo "Skipping migrations (initial run or no versions yet)"

# Start server
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
