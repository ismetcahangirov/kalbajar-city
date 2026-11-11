#!/bin/sh
# Nightly PostgreSQL backup (#13): one custom-format pg_dump, checked, kept
# with the newest BACKUP_KEEP copies (14 by default) on disk and, when
# BACKUP_S3_URI is set, in an S3-compatible bucket. See
# docs/runbooks/deploy.md → Backups for where and when it runs.
#
#   DATABASE_URL=postgres://... BACKUP_DIR=/backups scripts/db-backup.sh
#
# Environment:
#   DATABASE_URL          the database to dump (required)
#   BACKUP_DIR            local directory for the dumps (default /backups)
#   BACKUP_KEEP           copies kept in each place (default 14)
#   BACKUP_PREFIX         file name prefix (default kalbajar)
#   BACKUP_S3_URI         optional, s3://<bucket>/<prefix>; needs the aws CLI
#   BACKUP_S3_ENDPOINT    optional, the store's endpoint for a non-AWS S3
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION for S3
#
# Needs pg_dump and pg_restore of the server's major version (17), so run it
# in a postgres:17 image. Exits non-zero on any failure, so a scheduler can
# alert on it; a failed dump never replaces or prunes a good one.
set -eu

: "${DATABASE_URL:?DATABASE_URL is not set}"
dir=${BACKUP_DIR:-/backups}
keep=${BACKUP_KEEP:-14}
prefix=${BACKUP_PREFIX:-kalbajar}

case $keep in
  '' | *[!0-9]* | 0) echo "BACKUP_KEEP must be a positive integer, got '$keep'" >&2; exit 1 ;;
esac

mkdir -p "$dir"
# UTC and zero-padded, so name order is time order.
name="$prefix-$(date -u +%Y%m%dT%H%M%SZ).dump"
partial="$dir/.$name.partial"
trap 'rm -f "$partial"' EXIT

pg_dump --format=custom --compress=9 --no-owner --no-privileges \
  --dbname="$DATABASE_URL" --file="$partial"
# A dump pg_restore cannot read is not a backup.
pg_restore --list "$partial" > /dev/null
mv "$partial" "$dir/$name"
echo "backup: $dir/$name ($(wc -c < "$dir/$name" | tr -d ' ') bytes)"

# Keep the newest $keep local copies.
ls -1 "$dir" | grep -E "^$prefix-[0-9]{8}T[0-9]{6}Z\.dump\$" | sort -r | tail -n "+$((keep + 1))" |
  while read -r old; do
    rm -f "$dir/$old"
    echo "pruned: $dir/$old"
  done

[ -n "${BACKUP_S3_URI:-}" ] || exit 0

s3() {
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 "$@"
  else
    aws s3 "$@"
  fi
}

uri=${BACKUP_S3_URI%/}
s3 cp --only-show-errors "$dir/$name" "$uri/$name"
echo "uploaded: $uri/$name"

# Keep the newest $keep copies in the bucket too.
s3 ls "$uri/" | awk '{print $NF}' | grep -E "^$prefix-[0-9]{8}T[0-9]{6}Z\.dump\$" | sort -r |
  tail -n "+$((keep + 1))" | while read -r old; do
    s3 rm --only-show-errors "$uri/$old"
    echo "pruned: $uri/$old"
  done
