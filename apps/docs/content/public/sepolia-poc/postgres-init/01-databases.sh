#!/bin/bash
set -euo pipefail
for db in gateway archive actions exporter; do
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $db OWNER $POSTGRES_USER"
done
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d archive -f /docker-entrypoint-initdb.d/archive/create_schema.sql
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d actions -f /docker-entrypoint-initdb.d/actions/schema.sql
