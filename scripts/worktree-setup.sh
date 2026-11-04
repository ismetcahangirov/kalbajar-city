#!/usr/bin/env bash
# Prepares an isolated worktree for one issue, so several issues can be built
# side by side against the shared docker compose services:
#
#   scripts/worktree-setup.sh <issue> <branch> [parent dir, default ..]
#
# The worktree gets its own database and test database (kalbajar_w<issue>),
# its own S3 bucket (kalbajar-w<issue>) and E2E port (31<issue>), copied from
# this checkout's .env. Run it from the main checkout with `docker compose up`
# already running.
set -euo pipefail

issue=$1
branch=$2
main=$(git rev-parse --show-toplevel)
dir=$(cd "${3:-$main/..}" && pwd)/kc-$issue

git -C "$main" fetch -q origin
git -C "$main" worktree add -q -b "$branch" "$dir" origin/main

sed -e "/^DATABASE_URL=/s#/kalbajar\$#/kalbajar_w$issue#" \
  -e "/^S3_PUBLIC_URL=/s#/kalbajar\$#/kalbajar-w$issue#" \
  -e "s#^S3_BUCKET=.*#S3_BUCKET=kalbajar-w$issue#" \
  "$main/.env" > "$dir/.env"
url=$(grep '^DATABASE_URL=' "$dir/.env" | cut -d= -f2-)
printf '\nTEST_DATABASE_URL=%s\nE2E_PORT=31%s\n' "${url%/*}/kalbajar_w${issue}_test" "$issue" >> "$dir/.env"

for db in "kalbajar_w$issue" "kalbajar_w${issue}_test"; do
  docker compose -f "$main/docker-compose.yml" exec -T postgres \
    sh -c "dropdb -U \$POSTGRES_USER --if-exists $db && createdb -U \$POSTGRES_USER $db"
done

cd "$dir"
pnpm install --frozen-lockfile --prefer-offline > /dev/null
pnpm db:migrate > /dev/null
pnpm db:seed > /dev/null
# The bucket accepts uploads from the E2E server's origin too.
NEXT_PUBLIC_SITE_URL="http://localhost:31$issue" pnpm storage:setup > /dev/null

echo "ready: $dir ($branch), database kalbajar_w$issue, E2E port 31$issue"
