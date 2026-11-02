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
