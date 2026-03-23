#!/bin/sh
set -e
cd /app
if [ ! -x node_modules/.bin/vite ]; then
  echo "[frontend-dev] npm ci (first run or empty volume)..."
  npm ci
fi
exec "$@"
