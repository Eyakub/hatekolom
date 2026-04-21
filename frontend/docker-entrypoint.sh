#!/bin/sh
# Ensure node_modules are installed (handles volume mount overriding build layer)
if [ ! -d "node_modules/.package-lock.json" ] && [ ! -d "node_modules/next" ]; then
  echo "Installing dependencies..."
  npm install
fi

exec "$@"
