#!/bin/sh
set -e

if [ "${SEED_PORTAL:-false}" = "true" ]; then
  echo "Seeding portal demo data..."
  node dist/seedPortal.js || echo "Portal seed skipped or failed (database may already be seeded)."
fi

exec "$@"
