# Kalbajar City — website and administration console

Date: 2026-11-01
Status: approved for planning

## 1. What this is

Kalbajar City is the first private residential complex in Kalbajar (Kəlbəcər),
Azerbaijan, developed by InCity Projects. The current site, kalbajarcity.com, is
a single Azerbaijani page with a gallery and a floor-plan picker. Instagram
(@kalbajar.city) is the main marketing channel today.

The new site replaces it with a multilingual, fast, search-friendly sales site
and an administration console the developer's team runs without a programmer.

**The site's job is to turn a visitor into a qualified lead**: an apartment
inquiry, a viewing booking, or a call-back request, attributed to the apartment
and page it came from.

### Facts known today (from kalbajarcity.com and Instagram, 2026-11-01)

|                               |                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Total area                    | 22,634 m² on 1.13 ha                                                                                               |
| Residential / non-residential | 14,192 m² / 3,603 m²                                                                                               |
| Apartments                    | 143, in 6 buildings (9 blocks)                                                                                     |
| Layouts                       | 10 plans: 1-room 62.09 m², 2-room 74.4–102.17 m², 3-room 104.33–121.92 m², 4-room 142.79–186.9 m² (see below)      |
| Parking                       | 160 underground spaces                                                                                             |
| Amenities                     | 24/7 security and CCTV, fire safety systems, playground, insulated aluminium windows, gas, lobby, closed perimeter |
| Contacts                      | +994 12 434 32 32, +994 50 553 55 55                                                                               |
| Developer                     | InCity Projects (@incityprojects)                                                                                  |

These are seed data, not constants. Everything is editable in the console.

The layout count was first recorded as nine. kalbajarcity.com's "Öz mənzilini
seç" section lists ten plans with a room-by-room breakdown (checked
2026-11-02): one 1-room, two 2-room, four 3-room and three 4-room. The seed
uses those ten; the owner confirms the list with the inventory (#7).

## 2. Stack

The same stack as Mebline, which is in production and whose pitfalls are known.

| Concern          | Choice                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16 App Router, React 19, TypeScript `strict` + `noUncheckedIndexedAccess`                                                                                                            |
| Public rendering | React Server Components; HTML complete on first response (no streamed shell), data through `"use cache"` + `cacheTag`, invalidated on admin writes                                           |
| Client state     | Redux Toolkit for UI state; RTK Query for every client-side data call (admin console, catalogue filters, forms)                                                                              |
| Backend          | Next.js route handlers under `/api/v1/*`, zod validation at the boundary, one error shape                                                                                                    |
| Database         | PostgreSQL 17 + Drizzle ORM, versioned migrations                                                                                                                                            |
| Auth             | Better Auth, roles `owner`, `admin`, `editor`, `sales`                                                                                                                                       |
| Media            | S3-compatible object storage, presigned uploads, `sharp` variants and blur placeholders                                                                                                      |
| i18n             | next-intl; `az` is the default and unprefixed, `en` and `ru` are prefixed (`/en/...`, `/ru/...`)                                                                                             |
| URLs             | Route segments are Azerbaijani in every locale (`/menziller`, `/en/menziller`, `/ru/menziller`); slugs of content are Azerbaijani too. API paths stay English (`/api/v1/*`)                  |
| Styling          | Tailwind CSS v4 with design tokens; the console is built from shadcn/ui, navigation is its `Sidebar` (`collapsible="icon"`); on the public site shadcn only as restyled behaviour primitives |
| Motion           | In-house primitives on the Web Animations API and CSS `sticky` (GSAP dropped for the 40 KB budget, see `docs/motion-system.md`), Lenis smooth scroll; `prefers-reduced-motion` mandatory     |
| Typeface         | Alethia Next (Pepper Type), self-hosted WOFF2, subset to Latin, Latin Extended and Cyrillic                                                                                                  |
| Tests            | Vitest (unit, route handlers), Playwright (E2E, responsive), Lighthouse CI                                                                                                                   |
| Hosting          | Coolify on Hetzner, Docker standalone build, nightly `pg_dump` — owner decision pending                                                                                                      |

### Typeface

Alethia Next covers every Azerbaijani letter (Ə ə Ğ ğ I ı İ i Ş ş Ç ç Ö ö Ü ü) and
the full Russian alphabet. Its `fsType` is 4 (preview and print embedding), so
**web use needs a webfont licence from Pepper Type**. That is the owner's to
confirm. The design ships with at most four weights on public pages (Light,
Regular, Medium, Italic) to protect LCP. The console uses the system font stack.

## 3. Design direction

Reference: Pinterest pin 959477895690277539, a luxury real-estate site shown
on a laptop. Its vocabulary is kept, its look is not copied:

- Full-bleed cinematic hero (drone video with a poster frame, never blocking LCP)
- Warm off-white surfaces, large light-weight headlines, generous whitespace
  (the pin pairs a serif with a sans; ours is Alethia Next, a sans, alone)
- A stat row (area, apartments, parking, blocks)
- Image grids that reveal on scroll with a clip-path wipe
- A pinned "spaces made to be lived in" section where a framed card zooms into
  the next full-bleed image
- A numbered "path to your new home" process, testimonials, FAQ, final CTA
- A footer closing on a very large wordmark

Kalbajar City's own identity: mountain landscape, stone and timber tones, a
restrained gold accent. The pin's colours, copy and layout proportions are not
reproduced.

Imagery: real photos and renders come from the owner. Gaps are filled with
images generated through ChatGPT in the maintainer's browser, restricted to
atmosphere (landscape, materials, interior mood), recorded as
`source: generated` in the media library and captioned "illustrative" wherever
they could be mistaken for the real complex.

Motion rules: one scroll-entry primitive used everywhere; animate only
`transform`, `opacity` and `clip-path`; forms and the inquiry flow do not
animate; every effect has a reduced-motion fallback.

## 4. Public site

Azerbaijani is served without a prefix; English and Russian add `/en` or
`/ru` in front of the same Azerbaijani segments.

| Route                           | Content                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                             | Hero, stats, about, featured layouts, amenities, card-zoom section, location, construction progress, process, FAQ, CTA |
| `/menziller`                    | Catalogue filterable by rooms, area, block, floor, status; filters live in the URL                                     |
| `/menziller/[slug]`             | Plan, area breakdown, gallery, status, price (if enabled), inquiry form, similar apartments                            |
| `/kompleks`                     | Interactive selector: building → block → floor → apartment, over a facade image with SVG hotspots                      |
| `/haqqimizda`                   | The complex, amenities, developer                                                                                      |
| `/yerlesme`                     | Map, coordinates, distances, how to get there                                                                          |
| `/tikinti`                      | Progress timeline by month with photos and video                                                                       |
| `/qalereya`                     | Categorised gallery with lightbox                                                                                      |
| `/xeberler`, `/xeberler/[slug]` | Articles for search and announcements                                                                                  |
| `/elaqe`                        | Contacts, map, call-back and viewing forms                                                                             |
| `/mexfilik-siyaseti`            | Privacy notice                                                                                                         |

Lead forms: inquiry, viewing booking, call-back. Server-validated, rate-limited,
honeypot plus time-trap against spam, stored with UTM, locale and source page,
and e-mailed to the sales inbox. Phone and WhatsApp CTAs are always reachable on
mobile.

## 5. Administration console (`/admin`)

The console is in Azerbaijani and its routes are Azerbaijani too
(`/admin/menziller`, `/admin/muracietler`, `/admin/xeberler`, `/admin/ayarlar`).

| Module        | Capabilities                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Dashboard     | Leads this week by source, availability by status, recent activity                                                    |
| Inventory     | Buildings, blocks, floors, layout types, apartments; bulk status and price edits; CSV import and export               |
| Content       | News (rich text), construction updates, gallery, FAQ, home sections and hero media; az/en/ru tabs per entity          |
| Media library | Upload, crop focus point, alt text per locale, usage tracking                                                         |
| Leads         | List and filters, status pipeline (new → contacted → viewing → reserved → closed / lost), notes, assignee, CSV export |
| Settings      | Contacts, socials, price visibility, analytics IDs                                                                    |
| SEO           | Per-page title, description, OG image overrides; redirects                                                            |
| Users         | Invite, roles, deactivate; audit log of every privileged write                                                        |

Fully usable on a phone: the sales team works leads from mobile.

## 6. Search, GEO and performance

- Metadata API per route, canonical URLs, `hreflang` with `x-default`, localised
  sitemap, robots
- JSON-LD: `Organization`, `ApartmentComplex` with `geo` and `address`,
  `Apartment` + `Offer` (price only when published), `BreadcrumbList`,
  `FAQPage`, `NewsArticle`
- Generated OG images per apartment and article
- 301 redirects from every indexed kalbajarcity.com URL
- Local search: consistent name, address and phone across site, Google Business
  Profile and Instagram; `geo.position` and `ICBM` meta
- Generative engines: `llms.txt`, a facts block with plain, quotable statements,
  server-rendered content with no client-only text
- Budgets: Lighthouse Performance 93+ locally (Next 16 framework floor), LCP
  under 2.5 s on the live site, CLS under 0.05, no horizontal scroll from
  320 px to 1920 px, WCAG 2.2 AA

## 7. Decisions owed by the owner

Recorded as `status: needs-decision`. None of them blocks the build.

1. Hosting account and monthly cost; who owns the server and the domain DNS
2. Whether prices are shown publicly (built as a setting either way)
3. Rights to the photos, renders and video taken from Instagram and the old site
4. Webfont licence for Alethia Next
5. Map coordinates and the exact postal address
6. The apartment inventory: which apartment is on which block and floor, its
   layout and its status (until then the seed generates a demo set marked as such)
7. The logo as vector artwork, and the sales inbox for lead notifications

All of them are tracked in one issue, not one issue each.

## 8. Delivery

Five epics, each with sub-issues sized as one pull request:

1. Foundation & platform
2. Design system & motion
3. Public website
4. Administration console
5. Search, GEO, performance & quality

Small tasks are checklist items inside an issue, never issues of their own.
