#!/bin/bash
set -euo pipefail

SQL_DIR="/docker-entrypoint-initdb.d/sql"

echo "Initializing Ubaka database..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f "$SQL_DIR/schema.sql"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f "$SQL_DIR/migrations/002_portal.sql"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f "$SQL_DIR/migrate_v2_attendance.sql"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -f "$SQL_DIR/migrations/005_sysadmin.sql"

echo "Ubaka database initialization complete."
