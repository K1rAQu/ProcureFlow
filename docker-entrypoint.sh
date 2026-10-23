#!/bin/sh
set -e

mkdir -p /app/data /app/var/uploads 2>/dev/null || true

# If the database file does not exist or SEED_DEMO=true, initialize clean demo database
if [ ! -f "/app/data/procurement.db" ] || [ "$SEED_DEMO" = "true" ]; then
  echo "=> Initializing clean demo database..."
  node scripts/seed-clean-demo.mjs || true
fi

exec "$@"
