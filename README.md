# Kalbajar City

Website and administration console for Kalbajar City, the first private
residential complex in Kalbajar, Azerbaijan, developed by InCity Projects.

- Public site in Azerbaijani (default), English and Russian, with Azerbaijani
  route segments in every locale
- Administration console at `/admin` for inventory, content, leads, SEO and users
- Next.js 16, Redux Toolkit + RTK Query, PostgreSQL + Drizzle, Better Auth

## Documentation

| File                                                        | Contents                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------- |
| `CLAUDE.md`                                                 | Contribution rules: git workflow, issues, design, code, budgets |
| `docs/superpowers/specs/2026-11-01-kalbajar-city-design.md` | Product and architecture specification                          |

## Setup

Requirements: Node.js 24, pnpm 11, Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d     # Postgres, object storage, Mailpit
pnpm db:migrate          # apply migrations
pnpm db:seed             # known facts plus a demo inventory
pnpm auth:owner --email you@example.com --name "Your Name"   # asks for a password
pnpm dev                 # http://localhost:3010, console at /admin
```

Set `BETTER_AUTH_SECRET` in `.env` first (`openssl rand -base64 32`).

Local ports are offset so the project runs next to others:

| Service                           | Port        |
| --------------------------------- | ----------- |
| Next.js dev server                | 3010        |
| E2E server (production build)     | 3011        |
| PostgreSQL                        | 5442        |
| Object storage (RustFS) / console | 9010 / 9011 |
| Mailpit SMTP / UI                 | 1035 / 8035 |

## Scripts

| Script                         | Does                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| `pnpm dev`                     | Development server                                                  |
| `pnpm build`                   | Production build, then copies static assets into `.next/standalone` |
| `pnpm start`                   | Runs the standalone build                                           |
| `pnpm lint`                    | ESLint, zero warnings allowed                                       |
| `pnpm format` / `format:check` | Prettier                                                            |
| `pnpm typecheck`               | Route types, then `tsc --noEmit`                                    |
| `pnpm test`                    | Vitest unit tests                                                   |
| `pnpm test:e2e`                | Playwright against the production build (run `pnpm build` first)    |
| `pnpm test:db`                 | Database tests, against a fresh `<name>_test` database              |
| `pnpm db:generate`             | Writes a migration from schema changes in `src/db/schema`           |
| `pnpm db:migrate`              | Applies pending migrations                                          |
| `pnpm db:seed`                 | Loads seed data; safe to re-run, never overwrites console edits     |
| `pnpm db:studio`               | Drizzle Studio                                                      |
| `pnpm auth:owner`              | Creates the owner account or restores owner access (see below)      |
| `pnpm storage:setup`           | Creates the bucket and sets its CORS, policy and lifecycle (below)  |

Do not run `pnpm build` while `pnpm dev` is running in the same checkout.

## Console access

Better Auth serves `/api/v1/auth/*`; the console is `/admin`, signing in is
`/admin/giris` and password reset `/admin/sifre-berpa`.

- Roles and what each may do are one matrix in `src/lib/auth/permissions.ts`:
  `owner` everything; `admin` the same, but only an owner touches an owner
  account or grants the owner role; `editor` content, media and SEO; `sales`
  leads, read-only inventory and apartment status. Nobody can impersonate
- `proxy.ts` turns away requests without a session cookie. Pages call
  `requireUser(permission)` and handlers `authorize(request, permission)`
  from `@/lib/auth/session`, which check the session and the role
- Every privileged write calls `audit()` from `@/lib/audit` in the same
  transaction; Better Auth's own account changes are logged by the hooks in
  `src/lib/auth/hooks.ts`
- Ten failed sign-ins in a row lock an address for 15 minutes, whatever the
  IP; Better Auth also limits sign-ins to five a minute per IP
- `pnpm auth:owner --email … --name …` reads the password from
  `--password-file`, a pipe or a hidden prompt, never from the command line.
  It also lifts a lock, so it is how an owner who is locked out gets back in

## Leads

The inquiry, viewing and call-back forms are one component,
`src/components/leads/lead-form.tsx`, posting to `POST /api/v1/leads`.

- Spam: a hidden honeypot field and a three-second time trap. A submission
  caught by either is answered `201` like a real one and not stored
- Rate limit: five submissions per client IP in ten minutes, then `429` with
  `Retry-After`. It is counted in memory (`src/lib/rate-limit.ts`), which holds
  because production runs one standalone Node process. The client IP is the
  first `X-Forwarded-For` entry, so the reverse proxy must overwrite that
  header rather than append to one the client sent
- Each stored lead is e-mailed after the answer to `LEADS_INBOX` (or the
  contacts e-mail in settings) with a link to it in the console. A failed
  e-mail never loses the lead: the attempt is recorded on its timeline as a
  `notified` event with `ok: false`

## Database

The schema lives in `src/db/schema`, one file per area (inventory, media,
content, leads, site). Every change is a migration: edit the schema, run
`pnpm db:generate`, commit the SQL in `drizzle/` with it. CI fails when the two
drift apart.

- Translatable text is `jsonb` `{ az, en, ru }`, validated by
  `translatableSchema` (`src/shared/translatable.ts`) and read with
  `localize()` (`src/i18n/content.ts`), which falls back to `az`
- Prices are integers in the minor unit plus a currency code; areas are
  `numeric(8,2)` and arrive as strings
- The JSON in `settings.value` and `home_sections.content` is shaped by the zod
  schemas in `src/shared/settings.ts` and `src/shared/home-sections.ts`
- The seed's buildings, blocks, floors and apartments are `is_demo`: the
  owner's inventory (#7) replaces them, and the seed stops adding them once a
  real apartment exists
- Application code reads through `getDb()` from `@/db` (server-only), inside a
  component that has awaited `connection()`; scripts and tests use `connect()`
  from `@/db/client`

## Media

Files live in an S3-compatible bucket (`S3_*` in `.env.example`; RustFS in
development, whose bucket `docker compose up` prepares). `pnpm storage:setup`
does the same against any store: it creates the bucket, allows `PUT` and
`GET` from the site's origins (CORS), makes `media/*` public-read and nothing
else, and expires `uploads/` after a day. Run it once per environment, and
again after it changes (#25 added `GET`, which the console needs to capture a
video's poster frame).

- `uploads/<uuid>`: where the console sends a file with a presigned `PUT`
  (`POST /api/v1/admin/media/uploads`), valid for 15 minutes
- `originals/<id>.<ext>`: the untouched original of an image, private
- `media/<id>/<width>.<avif|webp>` and `media/<id>/video.mp4`: what pages load

`POST /api/v1/admin/media` checks the bytes (never the declared type), rotates
by EXIF, strips metadata, and writes AVIF and WebP at 480, 768, 960, 1600 and
2400 px wide (never upscaled), a blur placeholder and the dominant colour.
Videos must be H.264 MP4; the box tree is parsed in TypeScript, as the server
has no ffmpeg. Pages render images with `<Picture>` (`src/components/ui`),
which offers the variants with `sizes`, width and height. An image without
Azerbaijani alt text that is not marked decorative is not shown publicly, and
a file in use cannot be deleted: `mediaUsages()` (`src/lib/media/usages.ts`)
finds every reference.

The console's library (`/admin/media`, #25) uploads from the browser straight
to the bucket, so console pages get their Content Security Policy at request
time with the `S3_ENDPOINT` origin in `connect-src` (`src/lib/security/csp.ts`,
set in `src/proxy.ts`); public pages keep the build-time policy from
`next.config.ts`, built by the same function. A video's poster is a frame the
browser captures and uploads as an image, linked with `posterMediaId`.
