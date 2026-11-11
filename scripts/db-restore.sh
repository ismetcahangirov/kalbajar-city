#!/bin/sh
# Restores a dump from scripts/db-backup.sh into a database (#13): the
# restore drill into staging, or a recovery. See docs/runbooks/deploy.md →
# Restore drill.
#
#   DATABASE_URL=postgres://.../kalbajar_staging RESTORE_CONFIRM=kalbajar_staging \
#     scripts/db-restore.sh /backups/kalbajar-20261111T020000Z.dump
#
# It replaces every object the dump contains (--clean), so it refuses to run
# unless RESTORE_CONFIRM names the target database. Needs pg_restore and psql
# of the server's major version (17).
set -eu

dump=${1:?usage: db-restore.sh <file.dump>}
: "${DATABASE_URL:?DATABASE_URL is not set}"
[ -r "$dump" ] || { echo "cannot read $dump" >&2; exit 1; }

target=$(psql "$DATABASE_URL" --no-psqlrc --tuples-only --no-align --command 'select current_database()')
if [ "${RESTORE_CONFIRM:-}" != "$target" ]; then
  echo "This replaces the contents of database '$target'." >&2
  echo "Run again with RESTORE_CONFIRM=$target to go ahead." >&2
  exit 1
fi

pg_restore --list "$dump" > /dev/null
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error \
  --single-transaction --dbname="$DATABASE_URL" "$dump"
echo "restored $dump into $target"

# What the drill checks first: the migrations the dump carries, and the data.
psql "$DATABASE_URL" --no-psqlrc --command \
  'select count(*) as migrations, to_timestamp(max(created_at) / 1000) as latest from drizzle.__drizzle_migrations'
