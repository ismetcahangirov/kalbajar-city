# Launch checklist

The checklist behind the definition of done of #30: "Launch checklist in
`docs/runbooks/launch.md` is complete with evidence". Nothing here is done by
the code alone. Each item says what to do, who does it and, once done, what
proves it.

- **Owner**: InCity Projects (accounts, decisions, content, licences)
- **Maintainer**: whoever deploys and runs the site

Fill the **Evidence** line when an item is done: a link, a screenshot's path
or URL, and the date (`2026-11-20`). An item without evidence is not done. An
item the owner decides to launch without is marked `Launch without:` with the
reason and the date, as #7 asks.

Run the list top to bottom on the production URL once the site is deployed
(#13), then again after the DNS switch. Related documents:
[`README.md`](../../README.md) (setup, environment, media storage, cron),
[`local-search-checklist.md`](../local-search-checklist.md) (Google Business
Profile and Search Console steps in full), `CLAUDE.md` §5 (budgets).

The steps behind section 1 (Coolify, environment, migrations, backups and the
restore drill, Cloudflare, mail, staging, alerts) are in the deployment
runbook, [`deploy.md`](deploy.md); this list keeps the evidence.

---

## 1. Deployment (#13)

### 1.1 The proxy overwrites `X-Forwarded-For`

- **What:** the lead rate limit and the audit log trust the first
  `X-Forwarded-For` entry. The reverse proxy (Coolify's, behind Cloudflare)
  must replace the header, not append to one the client sent. From outside,
  send a request with `X-Forwarded-For: 203.0.113.9` and confirm, with the
  console's audit log or a test lead, that the recorded IP is not that value.
  Run one app instance: the lead rate limit is in memory.
- **Who:** maintainer
- **Evidence:**

### 1.2 `NEXT_PUBLIC_SITE_URL` and the other environment

- **What:** `NEXT_PUBLIC_SITE_URL` is `https://kalbajarcity.com`, set on the
  running server (it is read at run time, not at build). Check a canonical
  URL, `/sitemap.xml` and `/robots.txt` on production: all `https`, none
  `localhost`. Also set `BETTER_AUTH_URL` (the same origin),
  `BETTER_AUTH_SECRET`, `DATABASE_URL`, the `S3_*` variables, `SMTP_*`,
  `LEADS_INBOX` and `CRON_SECRET`; `.env.example` lists every variable.
- **Who:** maintainer
- **Evidence:**

### 1.3 Content Security Policy in a real browser

- **What:** open production in Chrome with the console open, on home, the
  catalogue, an apartment and `/admin`, and read the console. There must be
  no CSP violation, including for scripts the proxy or Cloudflare injects
  (Cloudflare's Email Obfuscation and Rocket Loader are to be off, see #13).
  An upload in the console (`/admin/media`) must reach the bucket: the
  console's CSP adds the `S3_ENDPOINT` origin at request time.
- **Who:** maintainer
- **Evidence:**

### 1.4 Backups and a restore drill

- **What:** nightly `pg_dump`, 14 copies kept. Restore one into staging and
  check that the site works on it (#13's definition of done). Steps:
  `deploy.md` sections 7 and 8.
- **Who:** maintainer
- **Evidence:**

### 1.5 Migrations, seed and the daily job

- **What:** apply the migrations before the deploy that needs them, then run
  `pnpm db:seed` once. Schedule `pnpm leads:retention` daily with
  `DATABASE_URL` (it anonymises leads idle longer than the retention period).
- **Who:** maintainer
- **Evidence:**

### 1.6 Mail: SMTP, SPF and DKIM, and a lead arriving

- **What:** SMTP works from production; SPF and DKIM are set for the sending
  domain. Submit a real inquiry from the live site and see it arrive in the
  sales inbox, with the link to the lead in the console (#13's definition of
  done).
- **Who:** maintainer (SMTP, DNS), owner (names the inbox, see 3.2)
- **Evidence:**

### 1.7 DNS, TLS, staging, uptime

- **What:** Cloudflare DNS for `kalbajarcity.com` with SSL Full (strict);
  Email Obfuscation and Rocket Loader off; a staging environment on a
  subdomain that answers `noindex`; an uptime check on `/api/health` and error
  alerts. Auto-deploy from `main` is live within minutes (#13).
- **Who:** maintainer; owner gives DNS access (#7)
- **Evidence:**

## 2. Content services (#25)

### 2.1 Scheduled publishing

- **What:** set `CRON_SECRET` on the server and a scheduler that calls
  `POST /api/v1/internal/scheduled-publications` with
  `Authorization: Bearer $CRON_SECRET` every few minutes (README → Content).
  Check: schedule a test article two minutes ahead and see it go live without
  a console action.
- **Who:** maintainer
- **Evidence:**

### 2.2 The bucket

- **What:** run `pnpm storage:setup` against the production bucket with the
  production `S3_*` set. It creates the bucket, makes `media/*` public-read and
  sets CORS for `PUT` and `GET` from the site's origins. `GET` matters: the
  console captures a video's poster frame in the browser. Check that a media
  upload and a video poster work from `/admin/media` on production.
- **Who:** maintainer
- **Evidence:**

### 2.3 News from a phone

- **What:** an editor publishes a news article in az, en and ru with a cover
  image from a real phone (#25's definition of done), and it shows on the
  site.
- **Who:** owner (an editor), with the maintainer present
- **Evidence:**

## 3. Owner data and content (#7)

### 3.1 Every stand-in replaced

- **What:** the owner enters the real values in the console settings
  (`/admin/ayarlar`): exact address and coordinates (turns on the map and the
  route links), distances to the town centre, Istisu, Murovdag, Ganja and Baku
  and the directions text, office hours, the sales e-mail, the logo (vector)
  and the WhatsApp number (the site uses the mobile line +994 50 553 55 55
  until confirmed). The console home shows **zero** unconfirmed stand-in
  values.
- **Who:** owner
- **Evidence:**

### 3.2 The sales inbox

- **What:** the owner names the address that receives new leads
  (`LEADS_INBOX`, or the contacts e-mail in settings), and confirms the lead
  retention period (the draft privacy notice says 24 months).
- **Who:** owner
- **Evidence:**

### 3.3 Real inventory, plans and imagery

- **What:** the apartment inventory (building, block, floor, layout, area,
  status), floor plans and facade renders replace the demo inventory. Generated
  images are replaced by real photos and renders wherever the owner has them
  (CLAUDE.md → Imagery); any that stay carry the "illustrative" caption.
  Prices: shown or "on request" is decided.
- **Who:** owner (supplies), maintainer (loads)
- **Evidence:**

### 3.4 Rights and licence

- **What:** written permission for the photos, renders and video taken from
  Instagram and the old site. The **Alethia Next web licence** from Pepper
  Type: the files' `fsType` is 4 (preview and print), so desktop licences do
  not cover web embedding. The repository stays private until this is settled.
- **Who:** owner
- **Evidence:**

### 3.5 Copy review

- **What:** an Azerbaijani speaker from the sales team signs off the az texts;
  en and ru are reviewed by a native speaker.
- **Who:** owner
- **Evidence:**

## 4. Search and measurement (#28, #29)

### 4.1 Search Console and Bing

- **What:** verify the Domain property for `kalbajarcity.com` in Google Search
  Console (DNS TXT record) and import it into Bing Webmaster Tools. Submit
  `https://kalbajarcity.com/sitemap.xml` in both, and request indexing of `/`.
  Steps in `local-search-checklist.md`.
- **Who:** owner (accounts), maintainer (DNS record)
- **Evidence:**

### 4.2 Rich Results Test

- **What:** run the test on production for home, an apartment, an article and
  the FAQ. All four pass (#28's definition of done).
- **Who:** maintainer
- **Evidence:**

### 4.3 The old site's URLs

- **What:** list the URLs Google has indexed for the old kalbajarcity.com
  (Search Console, or `site:kalbajarcity.com`) and request each one on
  production. Every one answers 301 to its new page. Compare the list with
  `src/config/legacy-redirects.ts` (today `/laq`, `/index`, `/index.html`) and
  add any that are missing before the DNS switch.
- **Who:** maintainer
- **Evidence:**

### 4.4 Google Business Profile

- **What:** create and verify the listing as `local-search-checklist.md`
  describes: name, category, address and pin identical to the console, the
  main phone, the website link with UTM, hours, real photos only. Name,
  address and phone match the site, the structured data and Instagram (#29).
- **Who:** owner
- **Evidence:**

### 4.5 Analytics IDs

- **What:** enter the GA4 and Meta Pixel IDs in `/admin/ayarlar/analitika`, if
  they exist. Check in a real browser that they start after the page has
  loaded and do not delay the LCP. Link Search Console to the GA4 property.
- **Who:** owner (IDs), maintainer (check)
- **Evidence:**

## 5. Quality on the live site (#30)

### 5.1 PageSpeed, mobile

- **What:** run PageSpeed Insights on production for home and an apartment,
  mobile. LCP is below 2.5 s on both. CLS below 0.05. CI has enforced
  Lighthouse 93+ on mobile since #102, but home passes with little margin
  (0.94) and CI measures a local server, so record the live numbers here,
  not only CI's.
- **Who:** maintainer
- **Evidence:**

### 5.2 Real devices

- **What:** walk home, the catalogue, an apartment, the inquiry form and the
  menu on a real iPhone and on a mid-range Android phone. Note any layout,
  scroll or animation problem, and that the form submits.
- **Who:** maintainer (owner lends a device if needed)
- **Evidence:**

### 5.3 The gates are green on the release commit

- **What:** `CI complete` is green on the commit that is deployed: the
  responsive, axe, keyboard and reduced-motion E2E gates, the JS budget and
  Lighthouse.
- **Who:** maintainer
- **Evidence:**
