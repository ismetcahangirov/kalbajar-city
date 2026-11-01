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
pnpm dev                 # http://localhost:3010
```

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

Do not run `pnpm build` while `pnpm dev` is running in the same checkout.
