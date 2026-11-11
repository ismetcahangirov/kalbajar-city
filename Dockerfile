# syntax=docker/dockerfile:1
#
# The production image (#13): the Next standalone server plus the three
# commands production runs next to it, bundled so the image needs no pnpm,
# tsx or dev dependencies. See docs/runbooks/deploy.md.
#
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://kalbajarcity.com -t kalbajar-city .
#   docker run --env-file .env -p 3000:3000 kalbajar-city          the site
#   docker run --env-file .env kalbajar-city node scripts/db-migrate.mjs
#   docker run --env-file .env kalbajar-city node scripts/db-seed.mjs
#   docker run --env-file .env kalbajar-city node scripts/leads-retention.mjs
#
# Debian, not Alpine: sharp's prebuilt glibc binaries are the ones CI and
# development run, and the build picks the platform it runs on, so the image
# must be built on (or for) the server's architecture.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The version in package.json's packageManager field.
RUN npm install --global --no-fund --no-audit pnpm@11.11.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=kalbajar-pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

COPY . .
# next.config reads it at build time to decide whether the Content Security
# Policy upgrades insecure requests; everything else reads it at run time.
# Pass the environment's public origin (Coolify: a build variable).
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN pnpm build && pnpm build:scripts

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0

# The standalone server with .next/static and public/ already copied in
# (scripts/prepare-standalone.mjs), including sharp's native libraries
# (next.config: outputFileTracingIncludes).
COPY --from=build --chown=node:node /app/.next/standalone ./
# Migrations, seed and lead retention, and the SQL the migrator applies.
COPY --from=build --chown=node:node /app/build/scripts ./scripts
COPY --from=build --chown=node:node /app/drizzle ./drizzle

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]
