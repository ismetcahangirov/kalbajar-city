# Deployment runbook

How Kalbajar City runs in production and staging, and how to set it up,
deploy, back up and restore it (#13). The launch checklist,
[`launch.md`](launch.md), holds the evidence that each step was done; this
document holds the steps.

> **Status: the hosting account, its cost and DNS access are the owner's
> decision (#13 is `status: needs-decision`).** What follows is the default
> stack named in #13, the one Mebline runs on. Every value that depends on
> that decision is written as a `<PLACEHOLDER>` in angle brackets. Replace
> them when the owner decides, and do not guess them.

---

## 1. The stack

| Part              | Default                                                    | Account-specific value         |
| ----------------- | ---------------------------------------------------------- | ------------------------------ |
| Server            | One Hetzner Cloud VM running Coolify (v4)                  | `<SERVER_IP>`, `<SERVER_TYPE>` |
| Application       | This repository's `Dockerfile`, one container per env      | —                              |
| Database          | PostgreSQL 17, a Coolify database resource per environment | `<DB_PASSWORD_*>`              |
| Object storage    | An S3-compatible bucket per environment                    | `<S3_ENDPOINT>`, keys          |
| Backups           | `scripts/db-backup.sh`, nightly, 14 copies, on disk and S3 | `<BACKUP_BUCKET>`              |
| DNS, TLS, CDN     | Cloudflare, proxied, SSL Full (strict)                     | Cloudflare account access      |
| Mail              | An SMTP provider, with SPF and DKIM for the sending domain | `<SMTP_HOST>`, credentials     |
| Uptime and alerts | An external uptime check plus Coolify notifications        | `<UPTIME_SERVICE>`, recipients |

| Environment | URL                        | Branch | Deploys                | Indexed                  |
| ----------- | -------------------------- | ------ | ---------------------- | ------------------------ |
| Production  | `https://kalbajarcity.com` | `main` | Automatically, on push | Yes                      |
| Staging     | `https://<STAGING_HOST>`   | `main` | Manually, on demand    | No (`SITE_NOINDEX=true`) |

`<STAGING_HOST>` is suggested as `staging.kalbajarcity.com`; the owner
confirms it with the DNS decision.

Run **one** application container per environment. The lead rate limit is
counted in memory (`src/lib/rate-limit.ts`, README → Leads), and the redirect
table is cached per process.

## 2. The image

`Dockerfile` builds the Next standalone server (`output: "standalone"` in
`next.config.ts`) on `node:24-bookworm-slim`. Debian rather than Alpine
because sharp's prebuilt glibc binaries are the ones CI runs; the build picks
sharp's binaries for the architecture it runs on, so build on the server (as
Coolify does) or for its architecture.

The image holds:

| Path            | What                                                    |
| --------------- | ------------------------------------------------------- |
| `server.js`     | The site. `CMD ["node", "server.js"]`, port `3000`      |
| `scripts/*.mjs` | The production scripts, bundled by `pnpm build:scripts` |
| `drizzle/`      | The migrations `db-migrate.mjs` applies                 |
| `HEALTHCHECK`   | `GET /api/health` every 30 s                            |

The bundled scripts are `db-migrate`, `db-seed`, `leads-retention`,
`auth-owner` and `storage-setup`: the `pnpm` scripts of the same names,
without needing pnpm, tsx or dev dependencies in the image.

The container runs as the unprivileged `node` user. No secret is baked in:
`.dockerignore` keeps `.env*` out of the build context and every secret is
given at run time.

One value is read at **build** time: `NEXT_PUBLIC_SITE_URL`. `next.config.ts`
uses it to decide whether the Content Security Policy sends
`upgrade-insecure-requests` (an `https://` origin) and allows `http:` images
(anything else). Everything else, including `NEXT_PUBLIC_SITE_URL` itself
for canonical URLs and e-mail links, is read at run time. Pass it as a build
argument; in Coolify, tick **Build Variable** on it.

Locally:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://kalbajarcity.com -t kalbajar-city .
docker run --rm --env-file .env -p 3000:3000 kalbajar-city
docker run --rm --env-file .env kalbajar-city node scripts/db-migrate.mjs
```

## 3. Environment variables

Every variable the application reads is in `.env.example`. Per environment:

| Variable                   | Production                                                            | Staging                                               | Read at  |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| `NEXT_PUBLIC_SITE_URL`     | `https://kalbajarcity.com`                                            | `https://<STAGING_HOST>`                              | Both     |
| `SITE_NOINDEX`             | unset                                                                 | `true`                                                | Run time |
| `DATABASE_URL`             | `postgres://kalbajar:<DB_PASSWORD_PROD>@<PROD_DB_HOST>:5432/kalbajar` | the staging database                                  | Run time |
| `BETTER_AUTH_URL`          | `https://kalbajarcity.com`                                            | `https://<STAGING_HOST>`                              | Run time |
| `BETTER_AUTH_SECRET`       | `openssl rand -base64 32`, own value                                  | its own value, never production's                     | Run time |
| `S3_ENDPOINT`              | `<S3_ENDPOINT>`                                                       | the same store                                        | Run time |
| `S3_REGION`                | `<S3_REGION>`                                                         | the same                                              | Run time |
| `S3_BUCKET`                | `<S3_BUCKET_PROD>`                                                    | `<S3_BUCKET_STAGING>`                                 | Run time |
| `S3_ACCESS_KEY_ID`         | a key scoped to the production bucket                                 | a key scoped to staging's bucket                      | Run time |
| `S3_SECRET_ACCESS_KEY`     | its secret                                                            | its secret                                            | Run time |
| `S3_PUBLIC_URL`            | `<S3_PUBLIC_URL_PROD>` (bucket or CDN)                                | `<S3_PUBLIC_URL_STAGING>`                             | Run time |
| `SMTP_HOST`                | `<SMTP_HOST>`                                                         | the same, or a test inbox                             | Run time |
| `SMTP_PORT`                | `<SMTP_PORT>` (587 with STARTTLS)                                     | the same                                              | Run time |
| `SMTP_USER`                | `<SMTP_USER>`                                                         | the same                                              | Run time |
| `SMTP_PASSWORD`            | `<SMTP_PASSWORD>`                                                     | the same                                              | Run time |
| `SMTP_FROM`                | `Kalbajar City <no-reply@kalbajarcity.com>`                           | `Kalbajar City (staging) <no-reply@kalbajarcity.com>` | Run time |
| `LEADS_INBOX`              | `<SALES_INBOX>` (owner names it, launch.md 3.2)                       | the maintainer's address                              | Run time |
| `CRON_SECRET`              | `openssl rand -base64 32`, own value                                  | its own value                                         | Run time |
| `TRUSTED_CLIENT_IP_HEADER` | `cf-connecting-ip`                                                    | `cf-connecting-ip`                                    | Run time |

Never copy production's `BETTER_AUTH_SECRET`, `CRON_SECRET` or S3 keys into
staging. A staging leak must not open production.

`TRUSTED_CLIENT_IP_HEADER` is the only header the lead rate limit, the audit
log and the sign-in rate limit read the client's IP from. Both environments
sit behind Cloudflare, which sets `CF-Connecting-IP` itself; the first
`X-Forwarded-For` entry is whatever the client sent and is never read while
the variable is set. Cloudflare must be the only way to the origin (§9:
the firewall allows ports 80 and 443 from Cloudflare's IP ranges only), or a
client that reaches the server directly can forge `CF-Connecting-IP` too.

## 4. Coolify setup

Once, by the maintainer, with the owner's Hetzner account (#13):

1. **Server.** Create the Hetzner Cloud VM (`<SERVER_TYPE>`, Ubuntu LTS,
   location `<HETZNER_LOCATION>`), add an SSH key, enable the Hetzner
   firewall with 22 (from `<MAINTAINER_IP>` only), 80 and 443 open. Install
   Coolify with its install script and open its dashboard at
   `https://<COOLIFY_HOST>`. Turn on two-factor authentication for every
   Coolify account.
2. **Project.** One project, `kalbajar-city`, with two environments:
   `production` and `staging`.
3. **Databases.** In each environment, a PostgreSQL resource on the
   `postgres:17-alpine` image, database `kalbajar`, user `kalbajar`, a
   generated password. Do **not** make it public; the application reaches it
   on Coolify's internal network by the resource's internal host name, which
   goes into `DATABASE_URL`.
4. **Application.** In each environment, an application from the private
   GitHub repository through Coolify's GitHub App (read access to this
   repository only):
   - Build pack: **Dockerfile**, at `/Dockerfile`
   - Branch: `main`
   - Port exposed: `3000`
   - Domain: `https://kalbajarcity.com` and `https://www.kalbajarcity.com`
     (production), `https://<STAGING_HOST>` (staging). Redirect `www` to the
     apex
   - Health check: path `/api/health`, port `3000`
   - Environment variables from section 3; `NEXT_PUBLIC_SITE_URL` marked
     **Build Variable**
   - **Pre-deployment command: `node scripts/db-migrate.mjs`** (section 5)
   - Auto deploy: **on** for production, so a merge to `main` is live in
     minutes with no manual step
5. **Scheduled tasks** on each application (Coolify runs them inside the
   running container):

   | Task                 | Schedule      | Command                                                                                                                                                                                     |
   | -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Scheduled publishing | `*/5 * * * *` | `node -e "fetch('http://127.0.0.1:3000/api/v1/internal/scheduled-publications',{method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>process.exit(r.ok?0:1))"` |
   | Lead retention       | `30 3 * * *`  | `node scripts/leads-retention.mjs`                                                                                                                                                          |

   The backup runs on the host, not in the application container, because
   the image has no `pg_dump` (section 7).

6. **Notifications.** In Coolify's notification settings, send deployment
   failures, container restarts and stopped or unhealthy containers to
   `<ALERT_EMAIL>` (and `<ALERT_CHAT>` if the owner wants a chat channel).

### First deploy

After the first successful deploy of each environment:

```bash
# Inside the application container (Coolify → the application → Terminal):
node scripts/storage-setup.mjs   # bucket, CORS for the site's origins, public media/*
node scripts/db-seed.mjs         # known facts; safe to run again
node scripts/auth-owner.mjs --email <OWNER_EMAIL> --name "<OWNER_NAME>"   # asks for a password
```

`db-migrate.mjs` has already run as the pre-deployment command. Then work
through [`launch.md`](launch.md) section 1.

## 5. Migrations and deploy order

Every schema change is a versioned migration in `drizzle/` (README →
Database). Production applies them **before** the deploy that needs them:

1. Coolify builds the new image from `main`.
2. The pre-deployment command, `node scripts/db-migrate.mjs`, runs with the
   environment's `DATABASE_URL` and applies every pending migration in
   order. Migrations already applied are skipped (CI checks that running
   them twice changes nothing).
3. If it fails, the deployment stops and the running version keeps serving.
   Fix the migration in a new pull request; never edit an applied one.
4. Only then does the new container start, pass its health check and take
   the traffic.

Confirm steps 2 and 3 once on staging when Coolify is set up, with the
installed Coolify version: deploy a branch whose migration fails on purpose
and check that the deployment stops and the previous container keeps
serving. If that version does not stop on a failed pre-deployment command,
run `node scripts/db-migrate.mjs` as a one-off from the new image before
switching instead, and note it here.

The old container serves requests while step 2 runs, so **a migration must
work with the code already running**:

- Adding a table, a nullable column or a column with a default is safe in one
  deploy
- Renaming or dropping a column, or making one `NOT NULL`, takes two: first
  ship code that no longer needs the old shape (and, for a rename, writes
  both), then the migration that removes it
- A migration that rewrites a large table, or anything hard to undo: take a
  backup by hand first (section 7, `db-backup.sh` with `BACKUP_PREFIX=pre-<pr>`)
  and run it on staging first

Rolling back the application is Coolify's redeploy of the previous
deployment. Migrations are forward-only: rolling the code back does not undo
one, which is why each one must be safe for the code before it. Data a bad
migration damaged comes back from a backup (section 8).

## 6. Staging

- Its own Coolify environment, database, bucket, secrets and
  `<STAGING_HOST>` subdomain (Cloudflare record as in section 9)
- `SITE_NOINDEX=true`: `robots.txt` disallows everything and names no
  sitemap, every public page has `<meta name="robots" content="noindex,
nofollow">`, and every public response sends `X-Robots-Tag: noindex,
nofollow` (`src/lib/seo/indexing.ts`). Any value other than `true`, `1`,
  `false`, `0` or empty fails loudly rather than guessing
- `LEADS_INBOX` is the maintainer's address, so a test lead never reaches
  sales
- Optionally behind Cloudflare Access, which also keeps the public out

Check after each staging deploy:

```bash
curl -s https://<STAGING_HOST>/robots.txt            # User-Agent: * / Disallow: /
curl -sI https://<STAGING_HOST>/ | grep -i x-robots  # X-Robots-Tag: noindex, nofollow
curl -sI https://kalbajarcity.com/ | grep -i x-robots # nothing on production
```

## 7. Backups

`scripts/db-backup.sh` takes one custom-format `pg_dump`, checks that
`pg_restore` can read it, and keeps the newest `BACKUP_KEEP` (14) copies on
disk and, with `BACKUP_S3_URI` set, in a bucket. A failed dump never replaces
or prunes a good one, and the script exits non-zero so the scheduler can
alert. Its header lists every variable.

Run it nightly on the server's host, in a throwaway `postgres:17-alpine`
container on Coolify's network (the database is not public), with the S3
copy in a bucket **other** than the media bucket, ideally another provider or
region (`<BACKUP_BUCKET>`):

```bash
# /srv/kalbajar/backup.env (chmod 600)
DATABASE_URL=postgres://kalbajar:<DB_PASSWORD_PROD>@<PROD_DB_HOST>:5432/kalbajar
BACKUP_DIR=/backups
BACKUP_KEEP=14
BACKUP_S3_URI=s3://<BACKUP_BUCKET>/postgres/production
BACKUP_S3_ENDPOINT=<BACKUP_S3_ENDPOINT>
AWS_ACCESS_KEY_ID=<BACKUP_KEY_ID>
AWS_SECRET_ACCESS_KEY=<BACKUP_SECRET>
AWS_DEFAULT_REGION=<BACKUP_REGION>
```

```bash
# Copy the script from this repository to the host once (and after it changes):
scp scripts/db-backup.sh scripts/db-restore.sh root@<SERVER_IP>:/srv/kalbajar/

# crontab -e on the host: 02:00 UTC (06:00 in Baku), then a heartbeat ping
0 2 * * * docker run --rm --network coolify --env-file /srv/kalbajar/backup.env \
  -v /srv/kalbajar/backups:/backups -v /srv/kalbajar/db-backup.sh:/db-backup.sh:ro \
  postgres:17-alpine sh -c 'apk add --no-cache aws-cli > /dev/null && sh /db-backup.sh' \
  >> /var/log/kalbajar-backup.log 2>&1 && curl -fsS -m 10 <BACKUP_HEARTBEAT_URL> > /dev/null
```

The heartbeat (`<BACKUP_HEARTBEAT_URL>`, from the uptime service in section 10) alerts when a night passes without a successful backup. The cron line is
one line; the backslashes are for reading.

Coolify's database resources also offer scheduled backups to S3. They may be
used as well, set to daily with 14 kept, but the restore drill below uses
this script's dumps, so the script stays the backup of record.

The media bucket is not in the dump. Turn on versioning, or a replication
rule to `<BACKUP_BUCKET>`, if the provider offers it; `originals/` is the
only copy of every uploaded image.

## 8. Restore drill

#13's definition of done: "A backup is restored into staging and the site
works on it". Do it before launch and then every quarter, and record each run
in `launch.md` 1.4 (date, dump name, result).

1. Take the newest production dump (from `/srv/kalbajar/backups` or
   `aws s3 cp s3://<BACKUP_BUCKET>/postgres/production/<file>.dump .`).
2. Stop staging's application in Coolify, so nothing writes during the
   restore.
3. Restore it into staging's database. `db-restore.sh` replaces everything
   the dump contains in one transaction, and refuses to run unless
   `RESTORE_CONFIRM` names the target database:

   ```bash
   docker run --rm --network coolify -v /srv/kalbajar:/srv/kalbajar \
     -e DATABASE_URL='postgres://kalbajar:<DB_PASSWORD_STAGING>@<STAGING_DB_HOST>:5432/kalbajar' \
     -e RESTORE_CONFIRM=kalbajar \
     postgres:17-alpine sh /srv/kalbajar/db-restore.sh /srv/kalbajar/backups/<file>.dump
   ```

   It prints the number of migrations in the restored database.

4. Redeploy staging's application. Its pre-deployment command applies any
   migration newer than the dump.
5. Check that it works: home, the catalogue and an apartment load; the
   console signs in with a production account (staging has its own
   `BETTER_AUTH_SECRET`, so existing sessions do not carry over, which is
   expected); a test inquiry appears in the console and reaches
   staging's `LEADS_INBOX`. Media URLs in the dump point at the production
   bucket's public URL, so images still load from production; that is
   expected in a drill.
6. Leads in the dump are real people's data. Staging holds them only for the
   drill: when it is over, restore a seeded database (`db-seed.mjs` on an
   empty one) or delete the leads.

Recovering production is the same with production's database and
`RESTORE_CONFIRM`, after taking one more backup of the broken state.

## 9. Cloudflare

DNS for `kalbajarcity.com` moves to Cloudflare (the owner gives access, #7).

- **Records:** `A kalbajarcity.com → <SERVER_IP>`, `A www → <SERVER_IP>`,
  `A <STAGING_HOST> → <SERVER_IP>`, all **proxied**. `A <COOLIFY_HOST> →
<SERVER_IP>`, DNS only or behind Cloudflare Access
- **SSL/TLS → Overview: Full (strict).** Cloudflare then accepts only a valid
  certificate from the server. Use a **Cloudflare Origin CA certificate**
  (SSL/TLS → Origin Server, 15 years, for `kalbajarcity.com` and
  `*.kalbajarcity.com`) installed in Coolify's proxy as a custom certificate.
  Let's Encrypt's HTTP challenge through a proxied record breaks once
  "Always Use HTTPS" is on, which is why the Origin CA certificate is the
  default
- **SSL/TLS → Edge Certificates:** Always Use HTTPS on, minimum TLS 1.2.
  The application already sends HSTS (`next.config.ts`); leave Cloudflare's
  HSTS off so the two never disagree
- **Scrape Shield → Email Address Obfuscation: off.** It rewrites `mailto:`
  links with an injected script, which the Content Security Policy blocks
- **Speed → Optimization → Rocket Loader: off.** It rewrites every
  `<script>`, which breaks the CSP and the hydration of the page
- **Caching:** the default level. Cloudflare does not cache HTML by default;
  do not add a "cache everything" rule, or console changes stop showing
- **Cloudflare must be the only way in.** Restrict ports 80 and 443 on the
  Hetzner firewall to [Cloudflare's IP ranges](https://www.cloudflare.com/ips/)
  (IPv4 and IPv6) once DNS is switched, so nobody reaches the origin around
  Cloudflare. This is not only hardening: the application trusts
  `CF-Connecting-IP` for the client's IP, and a request that reaches the
  origin directly can set that header to anything. Revisit the list when
  Cloudflare publishes changes to its ranges

**Client IP (launch.md 1.1).** With `TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip`
(§3) the lead rate limit, the audit log and the sign-in rate limit read only
`CF-Connecting-IP`, which Cloudflare sets itself. `X-Forwarded-For`, which
Cloudflare _appends_ to rather than replaces, is ignored. A request without
the header counts as one shared unknown client: limited together, recorded
with no IP. Run the check in launch.md 1.1 on production.

## 10. Mail: SMTP, SPF, DKIM

Lead notifications, password resets and invitations go out through SMTP
(`src/lib/mail.ts`). The provider is the owner's choice (`<SMTP_PROVIDER>`).

1. Create the sending domain `kalbajarcity.com` at the provider.
2. **SPF:** one TXT record on the apex, merging any existing one:
   `v=spf1 include:<SMTP_PROVIDER_SPF_INCLUDE> ~all`. A domain has exactly
   one SPF record; if Google Workspace or another mail service already sends
   for the domain, add its `include:` to the same record.
3. **DKIM:** the TXT or CNAME records the provider gives
   (`<selector>._domainkey.kalbajarcity.com`), DNS only (grey cloud).
4. **DMARC:** `TXT _dmarc.kalbajarcity.com "v=DMARC1; p=none; rua=mailto:<DMARC_REPORT_ADDRESS>"`
   to start; move to `p=quarantine` once reports show only legitimate mail.
5. Set `SMTP_*` and `SMTP_FROM` (an address on the verified domain).
6. Check: send a test lead from production; it reaches `LEADS_INBOX` (not
   spam) and the message's headers show `spf=pass` and `dkim=pass`. A failed
   send never loses a lead: it is on the lead's timeline as `notified`,
   `ok: false` (README → Leads).

## 11. Uptime and error alerts

- **Uptime:** `<UPTIME_SERVICE>` (an external service, so it notices when the
  whole server is down) checks every minute:
  - `https://kalbajarcity.com/api/health` expects `200` and `"status":"ok"`
  - `https://kalbajarcity.com/` expects `200` (the page reads the database,
    so this catches a database outage the health route does not)
  - the backup heartbeat from section 7, expected daily
- **Errors:** Coolify's notifications (section 4) cover failed deploys and
  crashed or unhealthy containers. The application logs every server error
  to the container's output, readable in Coolify. An error tracker (Sentry or
  similar) is not integrated: whether to add one is a follow-up for the
  owner, as it is another account and possibly another cost
- **Disk:** set Hetzner's or the uptime service's alert on disk usage above
  80 %: dumps and Docker images both grow on the same disk

Alerts go to `<ALERT_EMAIL>`. Record each check's link in launch.md 1.7.
