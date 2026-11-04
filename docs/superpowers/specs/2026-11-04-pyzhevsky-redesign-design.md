# Public-site redesign after pyzhevsky.ru

Status: approved by the owner, 2026-11-04. Supersedes the visual direction in
`docs/ui-kit.md` and `docs/motion-system.md` (the stone-and-timber direction
derived from the Pinterest pin) for the **public site**. The console keeps
shadcn/ui and the system font.

## 1. What the owner asked for

The public site must look and move like https://pyzhevsky.ru/ "down to every
detail, animation and transition". Two owner decisions narrow that:

- **Typeface: Alethia Next stays.** The reference sets text in ITC Garamond
  Light and labels and display words in Halvar Breitschrift. Both are
  commercial and are not ours to ship; the owner declined both a licence and
  free stand-ins. Every reference text style is mapped onto Alethia Next
  (§4.2)
- **Images:** every section that shows an image has a default image bundled
  with the site, taken from the complex's Instagram account
  (@kalbajar.city) or generated as atmosphere. The console can replace it;
  without a console choice the default shows (§8)

## 2. What is copied and what is not

Copied, as measured: the colour system and its themes, the grid and the
visible grid lines, spacing, the type scale and treatments (sizes, cases,
tracking, cap-height trimming), the scene structure of every page, every
scroll-driven and time-based animation with its trigger, distance, duration
and easing, the preloader, the page transition, the header, burger and menu,
the footer and next-chapter teaser, hover and focus states, the catalogue's
filter and card design.

The measurements are in
`.claude/skills/kalbajar-design/references/pyzhevsky-home.md` (home, 43
numbered animations A1–A43) and `pyzhevsky-pages.md` (chrome and inner
pages). Section numbers below (S0–S10, A1–A43) refer to them.

Not copied, and why:

| Not copied                                                                                                                 | Why                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Their renders, photos, video, copy, wordmark, logo, map art                                                                | Their property, and on a property site another building's pictures mislead a buyer. Our content comes from the console, the catalogue, Instagram and generated atmosphere                                                          |
| Their typefaces                                                                                                            | Licence; owner decision (§1)                                                                                                                                                                                                       |
| Text colours that fail WCAG 2.2 AA (`#BDB6A9` text on light, `#75736D` small text on `#F7F2E8`, 8 px labels at 80 % alpha) | CLAUDE.md: contrast failures are build errors. Each is replaced by the nearest palette colour that passes (§4.1). Decorative giant words keep the reference colour because they are `aria-hidden` and duplicated by a real heading |
| Ignoring `prefers-reduced-motion`                                                                                          | Mandatory here (§6.6)                                                                                                                                                                                                              |
| Animated form states (border, label, tick, submit fades)                                                                   | CLAUDE.md: forms do not animate. The modal panel that holds a form still wipes in; the fields change state instantly                                                                                                               |
| Favourites (heart button, counter, side modal)                                                                             | A feature, not a design; out of scope. The fixed-button slot is built so it can be added later                                                                                                                                     |
| 3D WebGL map page                                                                                                          | Our `/yerlesme` keeps the existing interactive map, restyled after their illustrated contacts map                                                                                                                                  |
| Developer/agency credits, broker cabinet, documents link                                                                   | Not applicable; footer slots show our legal links                                                                                                                                                                                  |

## 3. Rules that change

The owner's request is a design change, so the rules that encode the old
design change with it. PR 1 (§10) edits these files:

| File                                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` → Design                      | "One scroll-entry animation everywhere" becomes "the motion catalogue in `docs/motion-system.md`; a new animation is a design change to that document first". "Animate only transform, opacity and clip-path" gains `filter: blur()` for the text and image reveals (§6.3). "The Pinterest reference is a vocabulary…" becomes "pyzhevsky.ru is the reference; copy its system, never its content". Alethia Next rules stay; the four-weight limit stays |
| `docs/ui-kit.md`                          | Rewritten to §4–§5                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/motion-system.md`                   | Rewritten to §6                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `.claude/skills/kalbajar-design/SKILL.md` | Rewritten as the checklist for this direction; `reference-pin.md` is deleted, `motion-recipes.md` is updated, the two pyzhevsky files are added                                                                                                                                                                                                                                                                                                          |

Unchanged: tokens only (no literals in components), AA contrast, 320–1920 px
without horizontal scroll, 44 px touch targets, visible focus, reduced motion,
no-JS renders the final state, forms do not animate, performance budgets in
CLAUDE.md §5.

## 4. Tokens

### 4.1 Colour

Raw palette (`src/styles/tokens.css`), replacing the stone-and-timber palette:

| Token                 | Value     | Reference name              |
| --------------------- | --------- | --------------------------- |
| `--color-ink`         | `#12100E` | black                       |
| `--color-ink-hover`   | `#2F2B27` | black hover                 |
| `--color-cream`       | `#F7F2E8` | light                       |
| `--color-cream-hover` | `#FFFEFB` | light hover                 |
| `--color-sand`        | `#BDB6A9` | beige                       |
| `--color-sand-hover`  | `#D5CEC1` | beige hover                 |
| `--color-taupe`       | `#75736D` | dark-beige                  |
| `--color-taupe-hover` | `#88857E` | dark-beige hover            |
| `--color-umber`       | `#5F5A52` | gradient end                |
| `--color-graphite`    | `#1E1D1C` | facade panel gradient start |
| `--color-error`       | `#A40000` | error                       |
| `--color-sepia`       | `#4E361F` | menu hover tile             |

Themes are a `data-theme` attribute on a section (`light`, `dark`, `darker`,
`dark-alt`, `sand`), each defining the same semantic tokens: `--t-bg`,
`--t-text`, `--t-heading`, `--t-primary`, `--t-secondary`, `--t-small`,
`--t-line` (text at 10 %), `--t-line-alt` (30 % on dark, 20 % on dark-alt).
Values follow the reference's theme matrix (pyzhevsky-home.md §1) except where
AA fails:

- On `light`, readable text that the reference sets in `#75736D` below 24 px
  (or 18.66 px Medium) uses `--color-ink`; `#75736D` stays for leads ≥ 24 px
  (4.27 : 1 passes large text) and for decoration
- On `light` and `sand`, the reference's `#BDB6A9` and 80 %-alpha small text is
  replaced by `--color-taupe` on `light` at ≥ 24 px or `--color-ink` below
- On `dark`, `#BDB6A9` on `#12100E` is 9.4 : 1 and stays
- `tests/unit/contrast.test.ts` lists every pair used; the build fails on a
  pair under 4.5 : 1 (3 : 1 for large text and UI)

Gradients: `--gradient-curtain` `linear-gradient(180deg, ink, umber 100svh)`
(hero, preloader, page transition, catalogue background); `--gradient-facade`
`linear-gradient(180deg, graphite -4.81%, taupe 72.11%)`.

Old tokens used by the console (`--color-focus` and the shared colours named
in `src/app/admin/admin.css`) are remapped, not deleted, and the console is
checked by screenshot in PR 1.

### 4.2 Type, on Alethia Next

Root stays 16 px; sizes are `rem` with the reference's tiering expressed as
fluid `clamp()` between its measured 390 and 1440 values, and stepping up at
1920 and 2400 like the reference.

| Token             | Reference style                   | Alethia Next                | 1440    | 390   |
| ----------------- | --------------------------------- | --------------------------- | ------- | ----- |
| `--text-word`     | `.h1` giant word, Halvar 400 caps | Light, caps, tracking 0     | 107/140 | 30/30 |
| `--text-numeral`  | `.h2` numbers                     | Light                       | 60/60   | 30/30 |
| `--text-title`    | `.h3`                             | Light, caps, tracking .1em  | 45/60   | 30/30 |
| `--text-lead-lg`  | Garamond 45                       | Light                       | 45/45   | 22/22 |
| `--text-lead`     | Garamond 30                       | Light                       | 30/30   | 18/20 |
| `--text-body`     | Garamond 16                       | Regular, tracking .02em     | 16/20   | 15/19 |
| `--text-small-t`  | Garamond 13                       | Regular                     | 13/15   | 13/15 |
| `--text-label`    | Halvar 500 10 caps .2em           | Medium, caps, tracking .2em | 11/18   | 10/16 |
| `--text-label-xs` | Halvar 500 8 caps .2em            | Medium, caps, tracking .2em | 10/12   | 10/12 |

Deviations, all for legibility: body never under 15 px on mobile (reference
13 px), labels at least 10 px (reference 8–9 px). Alethia Next is narrower
than Halvar Breitschrift, so giant words keep their edge-to-edge spread
(letters are distributed with `justify-content: space-between`, which does not
depend on glyph width) and the per-letter animations are unchanged.

All text uses `text-box: trim-both cap alphabetic` where supported, with the
measured cap-height of Alethia Next as the fallback (`@supports not`), so
blocks space optically as in the reference.

### 4.3 Grid and spacing

- 12 full-bleed columns of `100vw / 12`, no gutter; content padding
  `--pad-layout` 20 px (15 px under 668 px, 30 px from 2400 px). 6 columns
  under 668 px
- Spacing unit `--u` 20 px desktop, 10 px mobile, 30 px from 2400 px; section
  paddings are multiples (`6u`, `9u`, `12u` = 120/180/240 px)
- `GridLines` component: 1 px verticals in `--t-line` at 50 %, thirds,
  quarters or 25/75 ("wider"); mobile shows the first line unless `mobileAll`.
  Lines draw in (§6.3)
- Radius 0 everywhere except round icon buttons (50 %)
- Borders 1 px; shadows only on the fixed round button
  (`drop-shadow(0 10px 6px rgb(18 16 14 / .15))`)

## 5. Components

Each component reads semantic tokens only, so it works on every theme.

| Component        | Spec                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SplitWord`      | One `aria-hidden` element per grapheme (`Intl.Segmenter`, so `Ə`, `İ` stay whole) in a flex row with `space-between`, first and last letters nudged `-.05em`, container `clip-path: inset(-.2em -.1em)`. A visually hidden heading carries the text. Accepts a per-letter animation (§6.4) |
| `GridLines`      | §4.3                                                                                                                                                                                                                                                                                       |
| `Label`          | `--text-label` caps text                                                                                                                                                                                                                                                                   |
| `RollLink`       | Caps link with the per-character hover roll (A36): the label twice, split into characters; hover moves row 1 up through a clip and row 2 up from 100 %, 600 ms `--ease-wipe`, 16 ms per character. Hit area +15 px each side. `aria-label` is the plain text                               |
| `UnderlineLink`  | Underline redrawn on hover: `::after` scaleX → 0 from the right, `::before` 0 → 1 from the left, 600 ms, second +50 ms                                                                                                                                                                     |
| `ArrowBlock`     | 330 × 90 block button: label top-left, 20 px circled arrow bottom-right; ink or cream fill; hover fill colour fades over 800 ms `--ease-wipe`                                                                                                                                              |
| `RoundButton`    | 30 × 30 circle (44 × 44 hit area); hover scales its background pseudo-element ×1.0667 over 400 ms                                                                                                                                                                                          |
| `Burger`         | Two 1 px × 60 px lines, 3 px apart; hover conveyor (A38): lines slide right `calc(100% + 7px)` while clones enter from the left, 800 ms `--ease-out`, line 2 +120 ms, leave line 1 +80 ms                                                                                                  |
| `FieldBox`       | Two-column 70 px box, 1 px border at 30 %, 1 px divider; floating label in `--text-label-xs`; hover/focus border ink — **instant**                                                                                                                                                         |
| `Checkbox`       | 20 × 20 (form) and 15 × 15 (filter), 1 px border, tick — instant                                                                                                                                                                                                                           |
| `Segmented`      | 40 px cells joined by −1 px margins; checked = cream fill, ink text                                                                                                                                                                                                                        |
| `RangeHairline`  | Two inputs, 1 px track at 30 %, 1 px filled connector, 1 × 10 px tick handles (with 44 px invisible hit area)                                                                                                                                                                              |
| `Tabs`           | Bottom tab bar (pages) and 50 px plan tabs (apartment); active 1 px underline                                                                                                                                                                                                              |
| `FlatCard`       | Cream card, padding 20: "2 OTAQ │ 83,99 m²" title, params row, finish label, plan, bottom row. Hover: background pseudo scales (1.023, 1.018) over 400 ms                                                                                                                                  |
| `LocationCard`   | 440 × 240 image with a 65 px bottom strip: 25 px round minutes badge, "DƏQ", place name                                                                                                                                                                                                    |
| `StatSpread`     | "-dan / -dək" numbers at the far edges, label centred, 1 px lines drawing outward (A30, A31)                                                                                                                                                                                               |
| `HoverList`      | Rows of `--text-lead-lg` with 1 px top rules, ⊕/⊖ icon, accent left border on hover/active; hover swaps a caption with the blur transition (A33). On touch: one-open accordion                                                                                                             |
| `TripleCarousel` | 3 per view, looping, centre slide between grid lines, images at 120 % with internal parallax; next/prev 1000 ms `cubic-bezier(.6,0,.1,1)`; cursor-following 30 px arrow on fine pointers; native horizontal scroller on touch                                                              |
| `BlurSlideshow`  | Portrait image changing every 5 s with a 1.4 s blur crossfade; paused when off-screen, when the tab is hidden and under reduced motion; pause button for WCAG 2.2.2                                                                                                                        |

## 6. Motion

### 6.1 Tokens

| Token                                                                      | Value                                                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `--ease-out`                                                               | `cubic-bezier(.25,.74,.22,.99)` (house curve: reveals, links, header, modals, cards)     |
| `--ease-wipe`                                                              | `cubic-bezier(.7,0,.4,1)` (wipes, load intro, character roll, button fills, line draws)  |
| `--ease-exit`                                                              | `cubic-bezier(.47,.04,.5,-.06)` (blur-out, tab content out)                              |
| `--ease-carousel`                                                          | `cubic-bezier(.6,0,.1,1)`                                                                |
| scrub easings                                                              | `linear`, `quadOut` (2t−t²), `quadIn` (t²), `quadInOut` — functions in `src/lib/motion/` |
| `--duration-fast` / `-normal` / `-button` / `-slow` / `-block` / `-reveal` | 200 / 400 / 600 / 800 / 1400 / 1600 ms                                                   |
| `--stagger-line` / `-glyph` / `-char` / `-roll` / `-group`                 | 40 / 50 / 10 / 16 / 180 ms                                                               |

### 6.2 Scenes (scroll engine)

Extends the existing frame loop (`src/lib/motion/frame.ts`), Lenis and the
sticky pin; no animation library is added.

- **Scene stack:** a page is a sequence of `Scene`s. A scene is a CSS grid of
  sticky layers (`position: sticky; top: 0; height: 100svh`). Modifiers
  `underPrevious` / `underNext` overlap neighbours by 100svh, and pairs are
  clipped with `clip-path: inset(100svh 0 0)` so the next scene slides over a
  pinned one or slides away to reveal it
- **Scrub:** `useScrub(ref, range, easing, apply)` computes progress from
  geometry measured on resize, with the reference's range notation
  (`"100-0"`, `"0-0"`, `"-100-0"`, `"90svh"`), passes it through the easing
  and writes `transform`, `clip-path` or `opacity`. No layout reads per frame
- **Threshold:** `useThreshold(ref, point, enter, leave)` toggles a class when
  the point is crossed; scrolling back plays the leave variant (reversible,
  as in the reference)
- **Reveal on entry:** `Reveal` (`text`, `image-in`, `clip-down`) with an
  `IntersectionObserver` (bottom margin −100 px, group threshold .5, stagger
  180 ms, delay 30 ms); desktop (`pointer: fine`, ≥ 668 px) only, as in the
  reference
- **Snap:** the home hero snaps between 0 and 100svh on wheel input in the
  first viewport, forward after 1/5 of a viewport (A43). Keyboard and touch
  are not snapped
- Lenis settings unchanged (`lerp .1`, fine pointers only)

### 6.3 Time-based transitions

| Name              | Change                                                        | Timing                                               |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `text` (A11)      | per line: `blur(20px)`, opacity 0, `translateY(100%)` → sharp | 1.6 s `--ease-out`, +40 ms per line; out reverses    |
| `image-in` (A12)  | `blur(20px)`, opacity 0 → clear                               | 1.6 s                                                |
| `clip-down` (A39) | `inset(0 0 100% 0)` → `inset(0)`                              | 1.6 s in / .8 s out, `--ease-wipe`                   |
| `clip-up` (A29)   | `inset(100% 0 0 0)` → `inset(0)`                              | 1.6 s in / .8 s out                                  |
| `lines` (A13)     | grid lines `scaleY 0 → 1`, alternating origin                 | .8 s `--ease-wipe`                                   |
| `swap` (A31)      | span ±140 % inside a clip                                     | .8 s `--ease-wipe`, leave delay 200 ms, enter 400 ms |

`filter: blur()` is allowed only in `text`, `image-in`, `BlurSlideshow` and the
hover-list caption swap, and only on elements no larger than a text block or a
portrait image (never a full-bleed layer), to keep paint cost bounded.

### 6.4 Per-letter word animations

On `SplitWord`, scrubbed: **spread** (letters start bunched toward the centre
and spread to the edges, A14), **explode** (letters fly outward, offsets
±7.5…±37.5vw, A15), **staircase** (letter _i_ rises from `(i+1)·2vw` out of the
clip, A16). Offsets are computed from the letter count, so any word in any
locale works.

### 6.5 Scroll effects used by scenes

Panel expand + zoom (A5), wordmark peel (A6), row drift (A7), doors (A18),
iris (A19), centre strip (A20), window expand (A21), scroll-through
background (A22), crossfade (A23), under-scroll (A24), pin hand-off (A25),
opposite movers (A26), background parallax (A27), internal image parallax
(A28), decorative drift (A41), footer rise (A42). Exact ranges, easings and
values are the reference's (pyzhevsky-home.md §3–§4).

### 6.6 Reduced motion, touch, no JS

- Reduced motion: no Lenis, no snap, no preloader animation (it hides as soon
  as the page is ready), no page-transition overlay, every scene renders its
  final state as a plain stacked page (pins off, clips open, letters at rest,
  crossfades at their end), slideshows and carousels do not auto-advance,
  hover rolls become instant colour changes
- Touch and under 668 px: native scroll, reveals off, scenes follow the
  reference's mobile variants (pyzhevsky-home.md §5)
- No JS: server HTML is the final state; nothing is hidden by CSS before the
  motion script runs (the existing hidden-until-ready rule stays)

## 7. Chrome and pages

### 7.1 Global

- **Preloader** (home, first visit in a session): curtain gradient rising
  with progress behind two grid lines, "YÜKLƏNİR" left and a percentage right,
  min 1.5 s, hides 1 s after ready with a .4 s fade, then hands off to the
  hero intro (A1–A4). It never delays the LCP image's request, and the hero
  poster is in the server HTML underneath. Skipped on repeat visits in the
  session and under reduced motion
- **Page transition** (desktop, motion allowed): intercept same-origin
  navigations from `@/i18n/navigation` links; curtain wipes up (.8 s
  `--ease-wipe`, bg and wordmark parallax, lines draw .4 s linear +.4 s),
  holds until the new route has rendered, then wipes off upward. Built on the
  App Router (`useRouter().push` after the IN phase, OUT on pathname change);
  browser back/forward skip the overlay
- **Header:** fixed 50 px (40 mobile), burger + "MƏNZİL SEÇ" left, wordmark
  centre, phone + "MÜRACİƏT ET" right; frosted collapse (blur 5 px, 1 px line)
  after scrolling; re-themes per section via `data-theme` markers; never
  hides. Home: wordmark fades in at 18–23svh
- **Menu:** desktop 540 px cream panel unrolling from the top over a 50 % ink
  backdrop, a row of image cards (one per main route) with sepia on the
  others on hover, small links below; mobile full-screen list. Focus trapped,
  Escape closes, focus returns to the burger
- **Footer:** sales office, wordmark, tagline, up button, legal row; rises
  5svh. Above it on chapter pages, the 480 px "NÖVBƏTİ" teaser of the next
  page with a cursor-following 120 px "KEÇ" button (fine pointers)
- **Bottom tab bar** on chapter pages with in-page sections; active tab
  follows scroll; dropdown on mobile
- **Cookie bar** in the reference style if analytics consent is required;
  otherwise not shown
- **Inquiry modal:** right half, sand panel, 90 × 90 taupe close tab, wipe in
  .8 s; fields instant

### 7.2 Home (`/`): our sections onto the reference's scenes

The console's section order still decides the order; each kind renders as
one reference scene.

| Our section  | Scene                                                                                                                                                        | Reference             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| hero         | Wordmark (SVG, per-glyph) over the curtain, portrait video tile, tagline, render panel in the right third that expands and zooms on the snap, wordmark peels | S0, A1–A7, A43        |
| about        | Full-bleed image panel with the blurred lead, then the cream card over a scroll-through background                                                           | S1a, S1c              |
| stats        | Iris to a full-bleed interior with `StatSpread` sets                                                                                                         | S5 middle             |
| layouts      | Sticky photo with `HoverList` of layout groups and their captions                                                                                            | S5 list               |
| card_zoom    | First scene: doors split with an exploding word; following scenes: iris                                                                                      | S4 intro, S5 middle   |
| amenities    | Sand layer, lead, `SplitWord`; window expands to full screen with up to four amenity labels                                                                  | S7                    |
| location     | "MƏKAN" stack: intro photo with paragraph, opposite movers, two `LocationCard` rows from `distances`, then the map                                           | S3                    |
| construction | Staircase word over a photo, progress and month in the alternating text blocks                                                                               | S9                    |
| process      | Staircase word, centred lead, four columns with dividers revealed top-down                                                                                   | S8                    |
| faq          | Hairline accordion on light, `RollLink`-style questions                                                                                                      | (reference accordion) |
| cta          | Sand form scene: portrait left, lead and `FieldBox` form right                                                                                               | S10                   |

Giant words come from the message catalogue per locale and section
(`Home.words.*`), so az, en and ru each spread their own word.

### 7.3 Inner pages

| Route                           | Reference page                                                                                                                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/menziller`                    | `/flats`: curtain background, 1/3 hairline filter (site picker from the complex selector, segmented rooms, ranges, checkboxes), 2/3 `FlatCard` grid with 40 px gap, count and sort header, "DAHA ÇOX"; mobile filter modal with sticky bar. Results change instantly (filters do not animate) |
| `/menziller/[slug]`             | `/flat/{id}`: sticky info column with `ArrowBlock` CTAs, plan card with "MƏNZİL / MƏRTƏBƏ" tabs, similar flats                                                                                                                                                                                |
| `/haqqimizda`                   | `/about`: split-title hero, quiet section, numbers, team cards, next teaser                                                                                                                                                                                                                   |
| `/kompleks`                     | `/architecture` + selector: split title, numeral cards, collage; the complex selector restyled in the hairline language                                                                                                                                                                       |
| `/yerlesme`                     | `/location`: scattered photos, statement, views, outlined category boxes, map in the illustrated style                                                                                                                                                                                        |
| `/qalereya`                     | `/spaces`: sticky screen slider with the thumbnail strip                                                                                                                                                                                                                                      |
| `/tikinti`                      | `/spaces` parking / engineering blocks: staircase title, updates as alternating text blocks with images                                                                                                                                                                                       |
| `/xeberler`, `/xeberler/[slug]` | `/news` list and article                                                                                                                                                                                                                                                                      |
| `/elaqe`                        | `/contacts`: split title with a centred image, three columns, illustrated map, inline form                                                                                                                                                                                                    |
| `/mexfilik-siyaseti`            | article layout                                                                                                                                                                                                                                                                                |

## 8. Default images

- Each image slot on the public site (section image, scene image, card
  image, page hero, menu card, next-page teaser) has a named default in
  `src/content/defaults/` (manifest `index.ts`): files in `public/defaults/`
  pre-encoded to AVIF and WebP at the widths `Picture` requests, with
  `width`, `height`, focus point, localised alt text (message catalogue) and
  `source: "instagram" | "generated"`
- Data loaders return `image ?? defaults.<slot>`; components never know
  whether an image is a default. The console's existing media pickers are
  the override; clearing a choice brings the default back
- **Instagram** (@kalbajar.city): photos and renders of the complex itself,
  downloaded at the highest resolution available, cropped to the slot's
  aspect ratio only. These may show the complex
- **Generated** (ChatGPT image generation in the maintainer's browser):
  atmosphere only — mountains, light, stone, timber, interior mood, leaf
  shadows on plaster (the reference's decorative layer). Never the complex,
  an apartment, a view from it or an unbuilt amenity. Each carries the
  "Illustrative" chip wherever it could be read as the real thing
- `docs/defaults.md` lists every default with its source post URL or prompt

## 9. Performance and accessibility checks

Per PR, as before: CI green (`CI complete`), `pnpm budget:js`, contrast test,
Playwright with reduced motion, screenshots at 390 and 1440 (orphan
`screenshots` branch), 320–1920 px without horizontal scroll, a performance
trace while scrolling the home page at 4× CPU throttle with no long tasks
from animation and no layout per frame. The home page's LCP element is the
hero poster or the render panel image, never the video, and never hidden at
first paint (the panel wipe animates `clip-path` on an already-painted
image).

## 10. Delivery

One epic, sub-issues in this order, one PR each:

1. **Rules and tokens:** CLAUDE.md, `docs/ui-kit.md`, `docs/motion-system.md`,
   skill; palette, themes, type scale, grid, spacing, motion tokens; console
   checked
2. **Scroll engine and primitives:** scenes, scrub, threshold, reveal, snap,
   `SplitWord` animations, `GridLines`; playground `/primitivler` updated
3. **Chrome:** header, burger, menu, preloader, page transition, footer and
   teaser, tab bar, inquiry modal, link components
4. **Default images:** manifest, loaders' fallback, Instagram collection,
   generated atmosphere, `docs/defaults.md`
5. **Home page:** every scene in §7.2
6. **Catalogue and apartment page**
7. **Inner pages:** §7.3 remaining routes

PRs 1 → 2 → 3 are sequential; 4 can run in parallel with 2–3; 5 needs 1–4;
6 and 7 need 1–3 and can run in parallel with 5.
