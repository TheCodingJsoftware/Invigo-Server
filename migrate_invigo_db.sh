#!/usr/bin/env bash
set -euo pipefail

# ======================
# CONFIG
# ======================
SRC_HOST="10.10.10.10"
SRC_PORT="5434"
SRC_USER="admin"
SRC_PASSWORD="Pine2admin"

DST_HOST="127.0.0.1"
DST_PORT="5432"
DST_USER="admin"
DST_PASSWORD="PostgresPassword123!"

DATABASES=("invigo" "workspace")

# ======================
# SANITY CHECKS
# ======================
echo "🔍 Checking source cluster..."
PGPASSWORD="$SRC_PASSWORD" psql \
  -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d postgres \
  -c "SELECT 1;" >/dev/null

echo "🔍 Checking target cluster..."
PGPASSWORD="$DST_PASSWORD" psql \
  -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d postgres \
  -c "SELECT 1;" >/dev/null

# ======================
# CONFIRM
# ======================
echo
echo "⚠️  WARNING"
echo "This will ERASE and REPLACE ONLY the following databases on the target:"
for db in "${DATABASES[@]}"; do
  echo "  - $db"
done
echo
read -p "Type YES to continue: " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
  echo "❌ Aborted."
  exit 1
fi

# ======================
# MIGRATION LOOP
# ======================
for DB in "${DATABASES[@]}"; do
  echo
  echo "🧨 Dropping target database: $DB"
  PGPASSWORD="$DST_PASSWORD" psql \
    -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$DB\";"

  echo "🆕 Creating target database: $DB"
  PGPASSWORD="$DST_PASSWORD" psql \
    -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d postgres \
    -c "CREATE DATABASE \"$DB\";"

  echo "🚚 Migrating database: $DB"
  PGPASSWORD="$SRC_PASSWORD" pg_dump \
    -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" "$DB" \
  | PGPASSWORD="$DST_PASSWORD" psql \
    -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" "$DB"

done

echo
echo "✅ Migration complete for: ${DATABASES[*]}"
