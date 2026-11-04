# Redesign handover (epic #61)

Everything a developer needs to finish the redesign of the public site after
https://pyzhevsky.ru/. Read this file, then the documents it links, before
picking an issue.

## Status (2026-11-04)

| Issue | What                                                                                                                                                                                   | State                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| #69   | Spec `docs/superpowers/specs/2026-11-04-pyzhevsky-redesign-design.md` and the measured reference                                                                                       | Merged                                      |
| #62   | Rules and tokens: `CLAUDE.md` → Design, `docs/ui-kit.md`, `docs/motion-system.md`, the `kalbajar-design` skill, palette, `data-theme` themes, type scale, grid, motion tokens (PR #70) | Merged                                      |
| #65   | Default images: `src/content/defaults/`, `defaultImage(slot, locale)`, 33 slots, originals in `assets/defaults/originals/` (PR #71)                                                    | Merged                                      |
| #63   | Scroll-scene engine and primitives                                                                                                                                                     | Open, next                                  |
| #67   | Catalogue and apartment page                                                                                                                                                           | Open, next (parallel with #63)              |
| #64   | Header, menu, preloader, page transition, footer; shell contracts in `docs/ui-kit.md` → Chrome                                                                                         | PR open (`feat/redesign-shell`)             |
| #66   | Home page as reference scenes                                                                                                                                                          | Open, after #63 and #64                     |
| #68   | Inner pages                                                                                                                                                                            | Open, after #63 and #64 (parallel with #66) |

Order: #63 and #67 in parallel → #64 → #66 and #68 in parallel. One issue,
one branch, one pull request, merged only on a green `CI complete`
(`CLAUDE.md` §1).

## Read first

1. `CLAUDE.md` (all of it; the Design section changed in #62)
2. The spec `docs/superpowers/specs/2026-11-04-pyzhevsky-redesign-design.md`
3. `docs/ui-kit.md` and `docs/motion-system.md` (rewritten in #62; they win
   over the spec where they are more specific)
4. The measured reference:
   `.claude/skills/kalbajar-design/references/pyzhevsky-home.md` (home
   scenes S0–S10, animations A1–A43, mobile) and `pyzhevsky-pages.md`
   (preloader, page transition, header, menu, footer, inner pages, states)
5. The reference screenshots in `docs/redesign/reference-shots/home/` (desktop
   1440 × 900 at named scroll positions; `m*` files are 390 × 844) and
   `docs/redesign/reference-shots/pages/`. Look at them for your scope; the
   live site is https://pyzhevsky.ru/
6. `docs/defaults.md` for the image slots

Owner decisions that are final: Alethia Next is the only typeface (Light,
Regular, Medium, Italic); the reference's content, photos, logo and typefaces
are never copied; every image slot shows a bundled default unless the console
sets an image; forms never animate; WCAG 2.2 AA and reduced motion are kept
even where the reference ignores them.

## Workspace

- Services: `docker compose up -d` in the main checkout (Postgres 5442,
  RustFS S3 9010, Mailpit 1035/8035)
- To build several issues side by side, give each its own worktree, database,
  bucket and E2E port: `scripts/worktree-setup.sh <issue> <branch>` (creates
  `../kc-<issue>` from `origin/main`)
- Checks, all green before pushing: `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm build`,
  `pnpm budget:js`, `pnpm test:e2e`. Do not run `pnpm build` while a dev
  server runs in the same checkout
- UI pull requests carry screenshots at 390 and 1440 px, committed to the
  orphan `screenshots` branch under `pr-<n>/` and embedded with
  `https://github.com/ismetcahangirov/kalbajar-city/blob/screenshots/pr-<n>/<file>.png?raw=true`
- Pull request body: `Closes #<issue>` (or `Part of #<issue>`), what changed,
  what was verified with the commands and results, and what was not done and
  why. Labels: copy the issue's

## Things learned so far

- `--text-title` is the new 45/60 title step; the old 18–22 px step was renamed
  `--text-legacy-title`. Other legacy type, colour and duration tokens are
  aliased and listed in `docs/ui-kit.md` for #64–#68 to delete once nothing
  uses them. `--duration-reveal` is now 1600 ms; the old primitives keep
  900 ms through `--duration-entry`
- The console keeps its look through `--console-*` tokens in
  `src/app/admin/admin.css`; check it by screenshot when shared tokens change
- `--t-control` exists because the reference's input borders fail 3 : 1
- On the curtain gradient, small sand text is allowed only in the top 70svh;
  red error text fails on sand panels, so the error colour is used for the
  border and icon there
- Cap-height trimming has a token but is not applied yet; apply it in the
  components you rebuild
- Instagram serves at most 1080 px, so full-bleed defaults are soft on wide
  screens; `home.cardZoom.1` and `page.kompleks` are only 648 px wide. Replace
  them from the console when the owner sends originals
- Most default slots are not displayed yet; #66–#68 connect them through
  `defaultImage()`
- Tailwind v4 makes `inline-<name>` / `block-<name>` utilities from
  `--spacing-<name>`: never name a spacing token `block` or `inline`
- The console has no "Default" label on empty image pickers yet; add it when
  the content editors (#25 part B) add pickers for these slots
- (#67) Exporting a component from the `@/components/ui` barrel put it in the
  shared JS (+1.5 KB): the shell's client components import the barrel. New
  components are imported by path
- (#67) Browsers lack Azerbaijani number data, so a client component that
  formats a decimal with `formatNumber(…, "az")` renders `62.09` where the
  server rendered `62,09` and hydration fails. Format decimals on the server,
  or whole numbers in client components
- (#67) Small sand text on the curtain fails below 70svh: themed blocks that
  run lower set `[--t-small:var(--t-text)]` (catalogue body, filter dialog,
  apartment page)
- (#67) The locale suggestion banner shares `--floating-bottom` with fixed
  buttons; it carries `data-locale-suggestion`, and the catalogue's "FİLTR"
  button lifts above it while it shows. #64's fixed round button needs the same
- (#67) `[data-theme] :focus-visible` takes the outline colour from `--t-text`
  (`src/styles/ui.css`); the global ring is `--color-focus`, ink on dark themes
- Scroll engine (#63): anything inside a pinned `SceneLayer` measures its
  range against the scene (`trigger: "scene"`), because a sticky layer's
  offset follows the scroll. A `Scrub`'s `style` is its server (final) state
  and comes back when motion stops. Import primitives from their own files,
  not `@/components/motion` (the legacy barrel), so a page loads only what it
  uses. The legacy `PinnedCardZoom` owns `[data-scene]` and
  `[data-scene-layer]`; the new scene uses `data-scroll-scene` and
  `data-layer` until the legacy one is deleted
- Text over photos in scenes: pick a dark default (dominant colours are in
  `src/content/defaults/encoded.json`); overlays on photos are not allowed
- (#64) With `cacheComponents`, Next keeps up to three visited routes in the
  DOM, hidden (`display: none`). Query the visible `main h1`, not the first
  one, and beware `:has()` on `html`: it matches the hidden pages too
- (#64) Next's `Link` ignores a click whose default is prevented, and React
  listens on the document: a listener that must win (the dialog controller,
  the page transition) goes on `window` in the capture phase
- (#64) `zod` is in the shared JS through the UTM helpers the tracking island
  imports. Moving it out cut shared to 156 KB but pushed `/menziller` and
  `/elaqe` over the 40 KB per-route cap, because each then carried its own
  copy; left for a follow-up that splits the schemas
- (#64) The E2E suite skips the preloader with the `kc-skip-preloader=1`
  cookie (`playwright.config.ts`); `tests/e2e/shell.spec.ts` clears it to test
  the preloader itself

---

## #63 Scroll-scene engine and primitives

Branch `feat/scroll-scenes`. Spec §6, `docs/motion-system.md`, reference
A1–A43. Build the engine and primitives; do not rebuild pages. Old primitives
that pages still import (`FadeUp`, `LineReveal`, `ImageReveal`, `Parallax`,
`PinnedCardZoom`, `CountUp`) stay until #66/#68 replace their uses.

- Extend the shared frame loop (`src/lib/motion/frame.ts`), the Lenis setup
  (`src/components/motion/smooth-scroll.tsx`) and the hidden-until-ready
  approach. No animation library. Geometry is measured on resize only, never
  read per frame; writes only `transform`, `clip-path`, `opacity` (and
  `filter` only for the blur reveals the docs name)
- `src/lib/motion/`: range parser for the reference notation (`"100-0"`,
  `"0-0"`, `"-100-0"`, `"-150%"`, `"90svh"`), easings (`linear`, `quadIn`,
  `quadOut`, `quadInOut`), clamp/interpolate helpers including `inset()` and
  `polygon()` interpolation. Pure and unit-tested
- Client components in `src/components/motion/`, imported only where used:
  - `Scene` / `SceneLayer`: sticky stack with `underPrevious` / `underNext`
    and clipped pairs; stacked static fallback under reduced motion, on touch
    or narrow screens where the reference's mobile variant is not sticky, and
    without JS
  - `useScrub(ref, { range, easing }, apply)` and a declarative
    `<Scrub range easing from to>` for transform/clip/opacity
  - `useThreshold` and `<Threshold>`: reversible enter/leave classes with CSS
    transitions from tokens
  - `<Reveal kind="text|image-in|clip-down|clip-up">`: IntersectionObserver
    per spec §6.2; `text` splits into lines after fonts load and re-splits on
    resize while the accessible text stays one string; desktop only, like the
    reference; reversible
  - `<SplitWord word mode="static|spread|explode|staircase">`: graphemes via
    `Intl.Segmenter` (Ə, İ stay whole), letters `aria-hidden`, the real
    heading is the caller's visually hidden element
  - `<GridLines variant="half|thirds|quarters|wider" alt mobileAll draw>`
    with draw-in (A13)
  - `<StatSwap>`: line draw and span swap (A30, A31)
  - Hero snap for Lenis (A43): wheel only, first viewport only
  - `useCursorFollower` (fine pointers) for carousel arrows and the "KEÇ"
    teaser button
- Playground `/primitivler/hereket` (behind `ENABLE_PRIMITIVES=1`): every
  primitive at realistic size, including doors, iris, centre strip, window
  expand, spread/explode/staircase words, the blur text reveal and a stack of
  three scenes, so #64/#66/#68 can copy usage from it
- Tests: unit tests for the pure functions; Playwright on the playground for
  final states under `reducedMotion: "reduce"`, with JavaScript disabled, at
  390 px, and one scrub measured at two scroll positions
- Performance: trace scrolling the playground at 4× CPU throttle with no long
  tasks from animation; report the motion JS size; `pnpm budget:js` green

## #67 Catalogue and apartment page

Branch `feat/redesign-catalogue`. Spec §5 (`Segmented`, `RangeHairline`,
`Checkbox`, `FlatCard`, `Tabs`, `ArrowBlock`), §7.3; reference
`pyzhevsky-pages.md` §3 `/flats` and `/flat/{id}`, screenshots
`reference-shots/pages/flats-*`, `flat-detail-*`. Can run in parallel with
#63: use CSS transitions only (card hover, tab underline), no scroll engine.
Do not edit `src/components/shell/**` (that is #64).

- `/menziller`: `data-theme="dark"` page on `--gradient-curtain`, two grid
  lines (thirds), title in `--text-title`, filter column 4/12 and grid 8/12;
  on mobile, a fixed bottom "FİLTR" button opening a filter dialog with the
  sticky blurred bar "N MƏNZİL GÖSTƏR" | "SIFIRLA". Filter controls in the
  hairline language: block picker, rooms as `Segmented`, area/price/floor as
  `RangeHairline`, 15 px checkboxes. Keep the filter logic, the Azerbaijani
  URL query keys, server rendering and RTK Query; change presentation unless a
  control type must change. Results and filters never animate. Count and sort
  header; "DAHA ÇOX" or pagination in the reference style; drop the view
  switch only if nothing depends on it (say so in the PR)
- `FlatCard`: cream card, "N OTAQ │ 83,99 m²" (formatted with
  `@/i18n/format`), params row, finish label, plan, bottom row; hover scales a
  background pseudo-element (1.023, 1.018) over 400 ms `--ease-out`; status
  shown with a word, never colour alone; reserved = plan at 50 % with a lock
- `/menziller/[slug]`: sticky info column (round back button, title in
  `--text-title`, params, price and price per m² as shown today, `ArrowBlock`
  inquiry CTA, plan PDF if it exists), plan card with `Tabs`
  "MƏNZİL / MƏRTƏBƏ" (floor tab only if floor plans exist), similar
  apartments. Keep JSON-LD, metadata and the inquiry flow
- New shared components go in `src/components/ui/` with token-only styling;
  #64 reuses `ArrowBlock` and `RoundButton`, so keep their APIs simple (`as`
  link/button, `tone`)
- Tests: keep the catalogue tests green; add E2E for the mobile filter dialog
  (open, apply, count) and keyboard use of `Segmented` and `RangeHairline`

## #64 Header, menu, preloader, page transition, footer

Branch `feat/redesign-shell`. Spec §5, §7.1; reference `pyzhevsky-pages.md`
§1 and screenshots `reference-shots/pages/header-*`, `menu-*`,
`preloader-*`, `page-transition-*`, `footer-*`, `about-1440-09`. Needs #63
(scrub, cursor follower, grid lines). Replaces `src/components/shell/*`.

- **Header:** fixed, 50 px (40 px mobile). Burger and "MƏNZİL SEÇ" left,
  wordmark centre, phone and "MÜRACİƏT ET" (opens the inquiry modal) right,
  all `RollLink`s. The language switcher (az/en/ru) is a product requirement
  the reference lacks: put it in the right group on desktop as label-size
  links, and in the menu on mobile. After scrolling, a background layer slides
  in (`translateY(-102%)` → 0, 800 ms `--ease-out`) with `blur(5px)` and a
  1 px line. The header takes the `data-theme` of the section under it
  (observe the sections; no layout reads per frame); follow
  `docs/motion-system.md` on whether the colour change transitions or is
  instant. Home only: the wordmark fades in over 18–23svh; on mobile the
  phone fades out and the wordmark takes its place. It never hides
- **Burger and menu:** `Burger` conveyor hover; desktop menu is a 540 px
  cream panel unrolling from the top (`clip-path`, 800 ms) over a 50 % ink
  backdrop, a row of image cards (one per main route, images from
  `defaultImage("page.<route>")`), small links below; non-hovered cards turn
  sepia through an overlay whose opacity transitions (never an animated
  filter). Mobile: full-screen list (`--text-title` size links, 1 px
  dividers, two `ArrowBlock`s). Focus trapped, Escape closes, focus returns to
  the burger
- **Preloader:** home only, first visit in a session (sessionStorage),
  skipped under reduced motion. Curtain rising with progress, "YÜKLƏNİR" and a
  percentage, minimum 1.5 s, hides 1 s after ready with a 400 ms fade. The
  hero underneath is server-rendered in its final state so the LCP element is
  painted early under the overlay; the intro start state is applied while the
  overlay still covers it, and the intro (A1–A4, built in #66) plays after the
  fade. Measure LCP with and without the preloader; the budget is < 2.5 s
- **Page transition:** desktop, motion allowed. A client provider intercepts
  same-origin clicks on `@/i18n/navigation` links (no modifier keys, no
  `target`), plays the curtain IN (800 ms `--ease-wipe`, background and
  wordmark parallax, lines drawing 400 ms linear after 400 ms), calls
  `router.push`, waits for the pathname change and the new page's first
  images, then plays OUT (wipe off upward). Back/forward, reduced motion and
  touch navigate normally. Focus moves to the new page's main heading
- **Footer:** sales office, wordmark, tagline, round up button, legal row;
  rises 5svh. On chapter pages, above it, the 480 px "NÖVBƏTİ" teaser of the
  next page (its `page.*` image, title in `--text-title`) with the
  cursor-following 120 px "KEÇ" button on fine pointers; a plain link on
  touch. Next-page order: menziller → kompleks → haqqimizda → yerlesme →
  qalereya → tikinti → xeberler → elaqe
- **Bottom tab bar** (`ChapterTabs`) for pages with in-page sections; the
  active tab follows scroll; a dropdown on mobile; fades out over the footer
- **Inquiry modal:** the right half on a sand panel with the 90 × 90 taupe
  close tab, wiping in over 800 ms; the form itself (`FieldBox`, checkbox,
  `ArrowBlock` submit) changes state instantly. Keep the deferred loading of
  the form and its store
- Keep every product function reachable: call, WhatsApp if configured,
  inquiry, language, contacts. If a cookie/consent banner exists, restyle it
  as the reference's; do not add one
- Delete the legacy tokens and shell components nothing uses any more

## #66 Home page as reference scenes

Branch `feat/redesign-home`. Spec §7.2; reference `pyzhevsky-home.md` §3–§5
and screenshots `reference-shots/home/*`. Needs #63 and #64.

- The console's section order still decides the order. Each section kind
  renders as one scene component in `src/components/home/scenes/`:

  | Section      | Scene                                                                                                                                                                                         | Reference                |
  | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
  | hero         | wordmark (per-glyph, masked), portrait video tile (console video, else the poster), tagline, `home.hero.panel` in the right third expanding and zooming on the snap, wordmark peel, row drift | S0, A1–A7, A43           |
  | about        | full-bleed `home.about.image` panel with the blurred lead, then the cream card over the scrolled-through `home.about.background`                                                              | S1a, S1c                 |
  | stats        | iris to `home.stats.background` with `StatSwap` sets built from the stats                                                                                                                     | S5 middle, A19, A30, A31 |
  | layouts      | sticky `home.layouts.background` with `HoverList` of layout groups and captions                                                                                                               | S5 list, A33             |
  | card_zoom    | first scene doors split with an exploding word, then iris per scene                                                                                                                           | S4 intro, A15, A18, A19  |
  | amenities    | sand layer, lead, `SplitWord`, `home.amenities.window` expanding to full screen with up to four amenity labels                                                                                | S7, A21                  |
  | location     | "MƏKAN" stack: `home.location.intro` with paragraph, opposite movers (`moverLeft`, `moverRight`), two `LocationCard` rows from `distances` (`home.location.card.1`…`6`), then the map         | S3, A17, A26, A29        |
  | construction | staircase word over `home.construction.background`, progress and month in the alternating text blocks                                                                                         | S9, A16, A40             |
  | process      | staircase word, centred lead, four columns with dividers revealed top-down                                                                                                                    | S8, A16, A39             |
  | faq          | hairline accordion on light                                                                                                                                                                   | reference accordion      |
  | cta          | sand form scene: `home.cta.portrait` left, lead and `FieldBox` form right                                                                                                                     | S10                      |

- Images: the loader's image, else `defaultImage(slot, locale)`; generated
  defaults show the "Illustrative" chip
- Giant words come from the message catalogue (`Home.words.*`) in az, en and
  ru, so each locale spreads its own word
- First paint and LCP: the hero is server-rendered in its final state (panel
  at 66.66 %, glyphs in place, poster visible). The load intro plays only when
  the preloader (#64) covered the first paint; on a repeat visit the hero
  stays as rendered. The video tile is never the LCP element
- Mobile: the reference's mobile variants (`pyzhevsky-home.md` §5): no panel
  scene, plain stacked photos where the reference stops pinning, carousels as
  native horizontal scrollers, `HoverList` as an accordion
- Reduced motion and no JS: every scene in its final state, stacked
- Remove the old home sections and primitives nothing uses any more
- Verify: performance trace at 4× CPU throttle while scrolling the whole page,
  LCP < 2.5 s and CLS < 0.05 (Lighthouse median of 3 ≥ 93), per-route JS
  < 40 KB gzip (`pnpm budget:js`), 320–1920 px without horizontal scroll, az/en/ru

## #68 Inner pages

Branch `feat/redesign-pages`. Spec §7.3; reference `pyzhevsky-pages.md` §2–§3
and screenshots `reference-shots/pages/*`. Needs #63 and #64; can run in
parallel with #66.

- Shared: `PageHero` with the split title (`SplitWord` over the page's
  `page.<route>` image or on a theme surface), subtitle, round down button;
  the hero moves with `sectionUnderNext`. `ChapterTabs` where a page has
  sections. The footer's next teaser (#64)
- Pages (reference page in brackets):
  - `/haqqimizda` (`/about`): quiet section with the lead and a growing
    portrait, numbers, team or partner cards if the content has them
  - `/kompleks` (`/architecture` and the selector): numeral cards, collage on
    four grid lines; the complex selector restyled in the hairline language
    (its interaction stays)
  - `/yerlesme` (`/location`): scattered photos with a statement, outlined
    category boxes, the existing interactive map restyled like the
    reference's illustrated contacts map (cream ground, thin streets, taupe
    pin)
  - `/qalereya` (`/spaces`): sticky screen slider with the thumbnail strip;
    images clip from one screen to the next
  - `/tikinti` (parking and engineering blocks): staircase title, updates as
    alternating text blocks with images
  - `/xeberler` and `/xeberler/[slug]` (`/news` and an article): taupe list
    page with a three-column grid; article with the `--text-lead-lg` title,
    date, rule, centred image and a 720 px body column
  - `/elaqe` (`/contacts`): split title with a centred image, three columns,
    the map, the inline form (instant states)
  - `/mexfilik-siyaseti`: the article layout
- Real data (news covers, gallery items, construction photos, plans) gets no
  default image; only the slots in `docs/defaults.md` do
- Keep metadata, JSON-LD, sitemap entries and `pathnames` as they are
- Remove the old page components and primitives nothing uses any more
