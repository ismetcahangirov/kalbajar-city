# UI kit

The visual system of the public site, after https://pyzhevsky.ru/ (owner
decision 2026-11-04, spec
[`2026-11-04-pyzhevsky-redesign-design.md`](superpowers/specs/2026-11-04-pyzhevsky-redesign-design.md)).
Motion lives in [`motion-system.md`](motion-system.md). The measured reference
is in
[`.claude/skills/kalbajar-design/references/pyzhevsky-home.md`](../.claude/skills/kalbajar-design/references/pyzhevsky-home.md)
(home, sections S0–S10, animations A1–A43) and
[`pyzhevsky-pages.md`](../.claude/skills/kalbajar-design/references/pyzhevsky-pages.md)
(chrome, inner pages, states).

Every value below is a token in **`src/styles/tokens.css`**, the only place a
colour literal, font size, radius, shadow, duration or easing may be written
(`pnpm lint:tokens`). New components read the **theme** tokens (`--t-*`);
current components read the **semantic** tokens until #64–#68 rebuild them.

The console (`/admin`) uses shadcn/ui and the system font stack. It shares the
semantic colour tokens and the focus ring, nothing else from this page; see
[Console](#console) at the end.

## Direction

We copy the reference's system, never its content. Copied as measured: the
colour system and its themes, the full-bleed grid and its visible grid lines,
spacing, the type scale and treatments (sizes, cases, tracking, cap-height
trimming), the scene structure of every page, the chrome, hover and focus
states, the catalogue's filter and cards. Not copied: their renders, photos,
video, copy, wordmark, logo, map art and typefaces, and every text colour that
fails WCAG 2.2 AA (replaced by the nearest palette colour that passes).

The result is a dark curtain and warm cream pages, near-black and taupe text,
giant caps words spread edge to edge, hairline grid lines as the skeleton,
square corners, and photography that does the selling.

## Colour

### Palette (raw tokens)

| Token                 | Value     | Reference name   | Role                                                               |
| --------------------- | --------- | ---------------- | ------------------------------------------------------------------ |
| `--color-ink`         | `#12100E` | black            | Dark backgrounds, text on light, the black button                  |
| `--color-ink-hover`   | `#2F2B27` | black hover      | Hover fill of ink buttons; raised surface on dark                  |
| `--color-cream`       | `#F7F2E8` | light            | Page background, text on dark, cards                               |
| `--color-cream-hover` | `#FFFEFB` | light hover      | Hover fill of cream buttons; text on `dark-alt`; raised on light   |
| `--color-sand`        | `#BDB6A9` | beige            | `sand` theme background; large titles, nav and small text on dark  |
| `--color-sand-hover`  | `#D5CEC1` | beige hover      | Hover of sand                                                      |
| `--color-taupe`       | `#75736D` | dark-beige       | Headings and leads ≥ 24 px on light; `dark-alt` background         |
| `--color-taupe-hover` | `#88857E` | dark-beige hover | Hover of taupe                                                     |
| `--color-umber`       | `#5F5A52` | gradient end     | The curtain's end; muted text on light (current components)        |
| `--color-graphite`    | `#1E1D1C` | facade panel     | The facade gradient's start; alternate surface on dark             |
| `--color-error`       | `#A40000` | error            | Error text on light; error border and icon on sand                 |
| `--color-sepia`       | `#4E361F` | menu hover tile  | The menu cards' sepia tile; status "reserved"                      |
| `--color-moss`        | `#3F5A3C` | —                | Status "available" only (the reference has no availability colour) |

Gradients:

| Token                | Value                                                    | Use                                                    |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `--gradient-curtain` | `linear-gradient(180deg, ink, umber 100svh)`             | Hero, preloader, page transition, catalogue background |
| `--gradient-facade`  | `linear-gradient(180deg, graphite -4.81%, taupe 72.11%)` | The render panel                                       |

### Themes (what new components use)

A section sets `data-theme="light|dark|darker|dark-alt|sand"`; the attribute
redefines the theme tokens for its subtree, and components never branch on the
theme. `:root` carries the `light` values. The header and the fixed buttons
re-theme themselves from the section underneath (#64).

| Token           | `light`           | `dark`          | `darker`        | `dark-alt`      | `sand`          |
| --------------- | ----------------- | --------------- | --------------- | --------------- | --------------- |
| `--t-bg`        | cream             | ink             | ink             | taupe           | sand            |
| `--t-text`      | ink               | cream           | sand            | cream-hover ¹   | ink             |
| `--t-heading`   | taupe (≥ 24 px)   | cream           | cream           | cream (≥ 24 px) | ink ²           |
| `--t-primary`   | taupe (≥ 24 px)   | sand            | sand            | cream (≥ 24 px) | ink ²           |
| `--t-secondary` | sand (decoration) | taupe (≥ 24 px) | taupe (≥ 24 px) | cream (≥ 24 px) | umber (≥ 24 px) |
| `--t-small`     | ink ³             | sand            | sand            | cream-hover ¹   | ink ³           |
| `--t-line`      | ink 10 %          | cream 10 %      | cream 10 %      | cream 20 %      | ink 10 %        |
| `--t-line-alt`  | ink 10 %          | cream 30 %      | cream 30 %      | cream 20 %      | ink 10 %        |
| `--t-control` ⁴ | taupe             | sand            | sand            | cream-hover     | umber           |

The AA adjustments to the reference's matrix:

1. On `dark-alt` the reference sets text in cream: 4.25 : 1 on taupe, under
   4.5. Cream-hover is 4.70 and looks the same
2. On `sand`, taupe would be 2.35 : 1; the reference itself sets its sand
   sections' words and leads in ink
3. On `light` and `sand`, the reference's small text (`#75736D` below 24 px,
   `#BDB6A9`, and the 80 %-alpha captions) fails. Small text is ink. Taupe
   stays for leads and headings at 24 px and above (4.25 : 1 passes large
   text) and for decoration
4. `--t-control` is not in the reference: its input borders (ink or cream at
   30 %) are under 3 : 1. Inputs, checkboxes and range tracks draw their
   boundary in `--t-control`, which passes 3 : 1. The 10 % and 30 % lines stay
   for decoration only

Rules:

- `--t-text` and `--t-small` pass at every size. `--t-heading`, `--t-primary`
  and `--t-secondary` are for text at 24 px and above (or 18.66 px Medium),
  where 3 : 1 is enough
- The light theme's `--t-secondary` (sand on cream, 1.80 : 1) is decoration
  only: an `aria-hidden` giant word duplicated by a real heading
- On the curtain (`--gradient-curtain`, `data-theme="dark"`) `--t-small` sand
  passes over the top 70svh (4.82 : 1 at 70svh, 3.40 at the umber end). Small
  text lower than that, or on the gradient's umber tail, uses `--t-text`
- Colour never carries meaning alone: an apartment status always shows its
  word, an error always shows a message and an icon
- Error text is `--color-error` on light only. On sand the message is
  `--t-text` and the red is the border and the icon (4.04 : 1, UI)

### Semantic tokens (current components)

Kept so every current page and the console keep working until #64–#68 move
them to the themes. They map onto the new palette; `data-tone="night"`
redefines them for a subtree, as before.

| Token                      | Light surface | On `night` |
| -------------------------- | ------------- | ---------- |
| `--color-surface`          | cream         | ink        |
| `--color-surface-alt`      | cream-hover   | graphite   |
| `--color-surface-raised`   | cream-hover   | ink-hover  |
| `--color-text`             | ink           | cream      |
| `--color-text-muted`       | umber         | sand       |
| `--color-text-accent`      | umber         | sand-hover |
| `--color-border`           | sand (decor)  | umber      |
| `--color-border-strong`    | taupe         | sand       |
| `--color-action`           | ink           | cream      |
| `--color-action-text`      | cream         | ink        |
| `--color-accent`           | sand (decor)  | sand       |
| `--color-focus`            | ink           | cream      |
| `--color-status-available` | moss          | —          |
| `--color-status-reserved`  | sepia         | —          |
| `--color-status-sold`      | umber         | —          |
| `--color-error`            | error         | —          |

`--color-surface-alt` is cream-hover rather than sand because the current
components set muted text (umber) on it, and umber on sand is 3.40 : 1.

### Contrast (WCAG 2.2 AA)

Measured with the WCAG relative-luminance formula on 2026-11-04.
`tests/unit/contrast.test.ts` re-checks every pair below from the token file;
a pair under its minimum fails the build.

| Pair                                     | Ratio                | Allowed for                                  |
| ---------------------------------------- | -------------------- | -------------------------------------------- |
| ink on cream                             | 17.01                | all text                                     |
| ink on cream-hover                       | 18.82                | all text                                     |
| ink on sand                              | 9.43                 | all text                                     |
| umber on cream                           | 6.13                 | all text                                     |
| umber on cream-hover                     | 6.78                 | all text                                     |
| taupe on cream                           | 4.25                 | text ≥ 24 px, inputs and icons (non-text)    |
| taupe on cream-hover                     | 4.70                 | all text, inputs                             |
| sand on cream                            | 1.80                 | **decoration only**: hairlines, hidden words |
| moss on cream / cream-hover              | 6.87 / 7.60          | status text                                  |
| sepia on cream / cream-hover             | 10.06 / 11.13        | status text                                  |
| error on cream / cream-hover             | 7.30 / 8.08          | error text                                   |
| error on sand                            | 4.04                 | error border and icon only                   |
| cream on ink                             | 17.01                | all text                                     |
| cream on graphite                        | 15.08                | all text                                     |
| cream on ink-hover                       | 12.58                | all text                                     |
| sand on ink                              | 9.43                 | all text                                     |
| sand on graphite                         | 8.36                 | all text                                     |
| sand on ink-hover                        | 6.97                 | all text                                     |
| sand-hover on ink / graphite / ink-hover | 12.14 / 10.76 / 8.98 | all text                                     |
| taupe on ink                             | 4.00                 | text ≥ 24 px                                 |
| umber on ink                             | 2.78                 | **decoration only**: borders on dark         |
| cream-hover on taupe                     | 4.70                 | all text                                     |
| cream on taupe                           | 4.25                 | text ≥ 24 px                                 |
| umber on sand                            | 3.40                 | text ≥ 24 px, inputs                         |
| sand on the curtain at 70svh / umber end | 4.82 / 3.40          | small text above 70svh / large text below    |
| cream on umber (curtain end)             | 6.13                 | all text                                     |

## Typography

**Alethia Next** (Pepper Type), self-hosted WOFF2, subset to Latin, Latin
Extended and Cyrillic, is the only face on public pages. The reference's ITC
Garamond Light and Halvar Breitschrift are commercial and not ours to ship;
every reference text style is mapped onto Alethia Next (owner decision). Four
styles ship:

| Token                  | File                  | Weight | Use                                               |
| ---------------------- | --------------------- | ------ | ------------------------------------------------- |
| `--font-weight-light`  | `AlethiaNext-Light`   | 300    | Giant words, numerals, titles, leads              |
| `--font-weight-normal` | `AlethiaNext-Regular` | 400    | Body, small text                                  |
| `--font-weight-medium` | `AlethiaNext-Medium`  | 500    | Labels, nav, buttons (the reference's Halvar 500) |
| (italic)               | `AlethiaNext-Italic`  | 400 i  | One emphasised phrase at most                     |

`--font-sans` is Alethia Next with a metric-matched Arial fallback
(`src/styles/font-fallback.css`), so the swap does not move text vertically.
Alethia Next has old-style, proportional figures and no `lnum` or `tnum`
feature: right-align numbers in lists so units line up. It has no manat sign
(`₼`): prices show `AZN`. Azerbaijani text is set with `lang="az"` so `İ`/`i`
and `I`/`ı` case correctly under `uppercase`. The brand, "Kalbajar City", is a
proper name and is marked `lang="en"` wherever it is uppercased, so it reads
"CITY", never "CİTY".

### Type scale

Root stays 16 px. Sizes are `rem`, fluid (`clamp()`) between the reference's
measured 390 px and 1440 px values; above 1440 they hold, then step up at
1920 px (`3xl`) and 2400 px (`4xl`) like the reference. Each step is a
Tailwind `--text-*` token with its line height, tracking and weight; caps are
the component's `uppercase`, not the token's.

| Token              | Reference style                   | Alethia Next                | 390   | 1440    | 1920    | 2400    |
| ------------------ | --------------------------------- | --------------------------- | ----- | ------- | ------- | ------- |
| `--text-word`      | `.h1` giant word, Halvar 400      | Light, caps, tracking 0     | 30/30 | 107/140 | 122/160 | 138/181 |
| `--text-numeral`   | `.h2` numbers                     | Light                       | 30/30 | 60/60   | —       | —       |
| `--text-title`     | `.h3`                             | Light, caps, tracking .1em  | 30/30 | 45/60   | —       | —       |
| `--text-lead-lg`   | Garamond 45                       | Light                       | 22/22 | 45/45   | 50/50   | 60/60   |
| `--text-lead`      | Garamond 30                       | Light                       | 18/20 | 30/30   | 34/34   | 45/45   |
| `--text-body`      | Garamond 16                       | Regular, tracking .02em     | 15/19 | 16/20   | 18/22   | 21/25   |
| `--text-small-t`   | Garamond 13                       | Regular, tracking .02em     | 13/15 | 13/15   | —       | —       |
| `--text-label`     | Halvar 500 10, caps .2em          | Medium, caps, tracking .2em | 10/16 | 11/18   | —       | 12/20   |
| `--text-label-xs`  | Halvar 500 8, caps .2em           | Medium, caps, tracking .2em | 10/12 | 10/12   | —       | —       |
| `--text-logo`      | Header logo (an image there)      | Light, caps, tracking .2em  | 15/15 | 20/20   | —       | —       |
| `--text-logo-lg`   | Footer and curtain logo           | Light, caps, tracking .2em  | 22/22 | 37/37   | —       | —       |
| `--text-hero-mark` | Home hero wordmark (an SVG there) | Light, caps, per glyph      | 29/29 | 81/81   | 104/104 | 128/128 |

Sizes are px size / line height. "—" holds the previous value. The logo is
set as text in Alethia Next until the owner sends a vector logo; it replaces
the old `--text-wordmark`.

Deviations from the reference, all for legibility:

- Body never under 15 px on mobile (reference 13 px)
- Labels at least 10 px (reference 8–9 px)
- Alethia Next is narrower than Halvar Breitschrift. Giant words keep their
  edge-to-edge spread because `SplitWord` distributes letters with
  `justify-content: space-between`, which does not depend on glyph width, and
  the per-letter animations are unchanged

Rules:

- One `h1` per page. A giant word is `aria-hidden`; a visually hidden heading
  carries its text
- Giant words come from the message catalogue per locale (`Home.words.*` and
  the page titles), so az, en and ru each spread their own word. Long Russian
  words are checked at 320 px
- Body measure at most 40 rem (`--container-prose`)
- Leads on light are `--t-primary` (taupe) only at 24 px and up; at 390 px
  `--text-lead` is 18 px, so a lead that shrinks below 24 px uses `--t-text`

### Cap-height trimming

All text is trimmed to cap height and baseline, so blocks space optically as in
the reference: `text-box: trim-both cap alphabetic` where supported. Where it is
not (`@supports not (text-box: trim-both cap alphabetic)`), a negative block
margin removes the same space. Alethia Next's metrics (OS/2, 1000 units per em):
ascender 850, descender 150, cap height 700, so the cap top sits 0.15 em below
the content box top and the baseline 0.15 em above its bottom. With line
height `L`, the fallback is:

```css
margin-block: calc((1em - L) / 2 - var(--font-cap-trim)); /* --font-cap-trim: 0.15em */
```

The utility that applies it is built with the primitives (#63); current
components are not trimmed.

## Grid and spacing

- **Columns:** 12 full-bleed columns with no gutter (6 under 668 px,
  `--grid-columns`). A column is the full-bleed container's width divided by
  the column count, never `100vw / 12`: `100vw` counts a classic scrollbar and
  overflows at 320 px (measured 2026-11-01 on the old wordmark)
- **Layout padding:** `--pad-layout` 15 px under 668 px, 20 px from 668 px,
  30 px from 2400 px; utility `px-layout`
- **Unit:** `--u` 10 px under 668 px, 20 px from 668 px, 30 px from 2400 px.
  Spacing is a multiple of it: utilities `*-u`, `*-u2`, `*-u3`, `*-u4`,
  `*-u6`, `*-u9`, `*-u12` (section paddings `6u`, `9u`, `12u` = 120, 180,
  240 px on desktop); other multiples are `calc(var(--u) * n)`
- **Breakpoints:** Tailwind's defaults plus `desk:` (668 px, the reference's
  switch from 6 to 12 columns, from the unit 10 to 20 and to desktop motion),
  `3xl:` (1920 px) and `4xl:` (2400 px)
- Never name a spacing token `block`, `inline` or after an existing utility:
  Tailwind derives `inline-<name>` and `block-<name>` size utilities from
  `--spacing-<name>` (the legacy `--spacing-block` already makes
  `inline-block` a size; `pnpm lint:tokens` forbids that class)
- Verify at 320, 390, 768, 1024, 1440, 1920 and 2400 px: no horizontal scroll

### Grid lines

The `GridLines` component (#63) draws the grid as the page's skeleton: 1 px
(`--grid-line-width`) verticals in `--t-line` (`--t-line-alt` for the `alt`
variant), absolutely positioned behind the content. Variants: one line at
50 %, two at thirds, three at quarters, or two at 25/75 % (`wider`). Mobile
shows the first line only unless `mobileAll`. Lines align with the image and
text columns, and draw in (motion-system → `lines`).

## Shape and depth

- **Radius 0** everywhere on the public site (`--radius-xs` … `--radius-lg`
  are 0). The one exception is round icon buttons and badges:
  `rounded-full`. The console keeps its own radii (see Console)
- **Borders 1 px**, in `--t-line` for decoration or `--t-control` for a
  control's boundary
- **One shadow:** the fixed round button, `--drop-shadow-button`
  (`0 10px 6px`, ink at 15 %). `--shadow-raised` and `--shadow-frame` are
  legacy (current cards and the pinned frame) and the console's

## Imagery

- Real photos, renders and video of the complex come from the owner (console
  media library). Every image slot on the public site (section image, scene
  image, card image, page hero, menu card, next-page teaser) also has a
  **bundled default** (#65): photos and renders of the complex from Instagram
  (@kalbajar.city), or generated atmosphere. The console's choice overrides
  the default; clearing it brings the default back. Components never know
  whether an image is a default
- Real data images (apartment plans and photos, news covers, gallery items)
  have no default: a missing plan is never faked
- Generated images are atmosphere only: mountains, light, stone, timber,
  interior mood, and the reference's decorative layer of leaf shadows on warm
  plaster. Never the complex, an apartment, a view from it or an unbuilt
  amenity (CLAUDE.md → Imagery). They show the `Illustrative` chip
  (`media.illustrative`) wherever they could be read as the real thing
- Every image has a focus point (`object-position`) and a blur placeholder.
  Aspect ratios are set by CSS, so images never shift layout
- Full-bleed images sit at 120 % of their frame for internal parallax
  (motion-system → A28); crops follow the reference's ratios per scene
- No filters, overlays or duotones on photos, except the menu's sepia tile on
  non-hovered cards and the next-page teaser's scrim (transparent at 60 % to
  ink at 20 %)

## Iconography

`lucide-react`, stroke width 1.5, `currentColor`, inline at 20 px. The
reference's own glyphs are drawn as small inline SVGs in `currentColor`: the
circled arrow of `ArrowBlock`, ⊕ / ⊖ of `HoverList`, the up arrow of the
footer. Icon-only controls carry an accessible name. Icons support a label;
they never replace one.

## Focus, targets and states

- **Focus:** a 2 px ring in the theme's text colour, as in the reference
  (`box-shadow: 0 0 0 2px var(--t-text)`), or the shared outline
  (`--focus-ring-width` 2 px, `--color-focus`, offset `--focus-ring-offset`)
  on current components, via `:focus-visible`. Never removed; it appears
  instantly
- **Targets:** at least 44 × 44 px. Controls drawn smaller than that (30 px
  round buttons, 15 px filter checkboxes, 1 × 10 px range handles, 10 px caps
  links) get an invisible hit area: links +15 px each side as in the
  reference, everything else padded to 44 px
- **Hover** never carries information that focus and touch lack. Hover
  effects follow the motion catalogue (character roll, underline redraw, fill
  colour fade, background scale)
- **Forms:** hover, focus, filled, error and success states change instantly
  (CLAUDE.md: forms do not animate). Error = border and label in
  `--color-error` (on light) plus a message and an icon
- **Disabled:** 45 % opacity (`--opacity-disabled`) plus `aria-disabled`;
  never the only signal of why

## Components

Built by the PRs named; each reads theme tokens only, so it works on every
theme. Motion details are in `motion-system.md`.

| Component        | PR  | Spec                                                                                                                                                                                                                                                                              |
| ---------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SplitWord`      | #63 | One `aria-hidden` element per grapheme (`Intl.Segmenter`, so `Ə`, `İ` stay whole) in a flex row with `space-between`, first and last letters nudged `-.05em`, container `clip-path: inset(-.2em -.1em)`. A visually hidden heading carries the text. Takes a per-letter animation |
| `GridLines`      | #63 | See Grid lines                                                                                                                                                                                                                                                                    |
| `Label`          | #63 | `--text-label` caps text in `--t-small`                                                                                                                                                                                                                                           |
| `RollLink`       | #64 | Caps link with the per-character hover roll (A36). Hit area +15 px each side. `aria-label` is the plain text                                                                                                                                                                      |
| `UnderlineLink`  | #64 | Underline redrawn on hover: `::after` shrinks to the right, `::before` grows from the left                                                                                                                                                                                        |
| `ArrowBlock`     | #67 | 330 × 90 block button: label top-left, 20 px circled arrow bottom-right; ink or cream fill; hover fill fades to the hover colour. `as` `link` / `a` / `button`, `tone` `cream` / `ink`, `arrow` `right` / `down`                                                                  |
| `RoundButton`    | #67 | 30 × 30 circle in a 44 × 44 hit area; hover scales its background ×1.0667. `as` `link` / `a` / `button`, `tone` `line` / `cream` / `ink`, `label` (accessible name), `icon`                                                                                                       |
| `Burger`         | #64 | Two 1 px × 60 px lines 3 px apart in a 44 px hit area; hover conveyor (A38)                                                                                                                                                                                                       |
| `FieldBox`       | #64 | Two-column 70 px box, 1 px `--t-control` border and divider; floating label in `--text-label-xs`; hover and focus border ink, **instant**                                                                                                                                         |
| `Checkbox`       | #67 | 20 × 20 (form, with `FieldBox` in #64; `size="form"` keeps the current box until then) and 15 × 15 (`size="filter"`, 44 px hit area), 1 px `--t-control` border, tick — instant                                                                                                   |
| `Segmented`      | #67 | 40 px cells joined by −1 px margins; checked = cream fill, ink text                                                                                                                                                                                                               |
| `RangeHairline`  | #67 | Two inputs, 1 px `--t-control` track, 1 px filled connector, 1 × 10 px tick handles with a 44 px invisible hit area                                                                                                                                                               |
| `Tabs`           | #67 | 50 px plan tabs on the apartment page (#67); the bottom tab bar on chapter pages (dropdown on mobile) is #64's. Active = 1 px underline                                                                                                                                           |
| `FlatCard`       | #67 | Cream card, padding 20: "2 OTAQ │ 83,99 m²" title, params row, finish label, plan, bottom row. Hover: background scales (1.023, 1.018)                                                                                                                                            |
| `LocationCard`   | #66 | 440 × 240 image with a 65 px bottom strip: 25 px round minutes badge, "DƏQ", place name                                                                                                                                                                                           |
| `StatSpread`     | #66 | "-dan / -dək" numbers at the far edges, label centred, 1 px lines drawing outward (A30, A31)                                                                                                                                                                                      |
| `HoverList`      | #66 | Rows of `--text-lead-lg` with 1 px top rules, ⊕ / ⊖ icon, accent left border on hover and active; hover swaps a caption (A33). On touch: a one-open accordion                                                                                                                     |
| `TripleCarousel` | #66 | 3 per view, looping, centre slide between grid lines, images at 120 % with internal parallax; cursor-following arrow on fine pointers; a native horizontal scroller on touch                                                                                                      |
| `BlurSlideshow`  | #66 | Portrait image changing every 5 s with a blur crossfade; paused off-screen, when the tab is hidden and under reduced motion; a pause button (WCAG 2.2.2)                                                                                                                          |

The #67 components (`ArrowBlock`, `FlatCard`, `RangeHairline`, `RoundButton`,
`Segmented`, `Tabs`) are imported by path (`@/components/ui/arrow-block`), not
through the `@/components/ui` barrel: the shell's client components import the
barrel, and anything exported there reaches the JS every public route shares.

Chrome (#64, `src/components/shell/`): header (fixed 50 px, 40 px mobile,
66 px from 2400 px; frosted after scrolling; never hides), menu (540 px cream
panel over a 50 % ink backdrop, image cards with sepia on the others; a
full-screen list on mobile), preloader, page transition, footer and the
480 px next-page teaser, bottom tab bar, inquiry modal (right half, sand
panel, 90 × 90 taupe close tab). Pages: spec §7. The contracts pages use:

- **Theme under the header** (A10): a section off the default light ground
  carries `data-theme` (`dark`, `darker`, `dark-alt`, `sand`, `light`; the
  legacy `data-tone="night"` counts as dark) on an element inside `main`.
  `observeThemeAt()` (`src/lib/shell/theme-observer.ts`) picks the last
  themed element in document order under the header's middle line; nothing
  is measured per frame. Elements are collected on each route change
- **Next-page teaser:** a chapter page renders `<NextChapter current="/x" />`
  last in its content; the order and images (`page.<slug>` slots) are
  `chapters` in `src/components/shell/navigation.ts`. `/elaqe` has none
- **Bottom tab bar:** `<ChapterTabs label="…" tabs={[{ id, label }]} />`,
  each `id` a section's `id`; the active tab follows the scroll and the bar
  fades out over the footer
- **Inquiry modal:** any element with `data-dialog-open="inquiry"` opens it
  (make it a link to `/elaqe`, so it works before hydration and in a new
  tab), or `openShellDialog("inquiry")` from `src/lib/shell/dialogs.ts`.
  The form loads only when the modal opens (or a trigger is hovered)
- **Links:** `RollLink` (`as` link / `a` / `button`) and the
  `underline-link` class; `BrandLink` is the text logo. A link with
  `data-no-transition` skips the page curtain
- **Fixed round buttons** sit at `bottom: var(--floating-bottom)` and lift by
  `--locale-suggestion-space` while `[data-locale-suggestion]` shows

The other current components (`Container`, `Section`, `Heading`, `Text`,
`Button`, `Card`, `Badge`, `Stat`, the old form fields …) stay on the semantic
tokens and the legacy type steps until their page's PR replaces them.

## Legacy tokens

Kept only while a current component uses them; #64–#68 delete them with the
components.

| Legacy token                                                                               | Now                                                                                 |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `--text-display-xl`, `--text-display`, `--text-heading`, `--text-stat`                     | Sizes of `--text-word`, `--text-title`, `--text-lead`, `--text-numeral`             |
| `--text-body-lg`, `--text-small`, `--text-eyebrow`                                         | Sizes of `--text-lead`, `--text-small-t`, `--text-label`                            |
| `--text-legacy-title`                                                                      | The old 18–22 px `title`, unchanged (the name `--text-title` is the new caps title) |
| `--spacing-gutter`, `--spacing-block`, `--spacing-section`, `--container-*`                | Unchanged                                                                           |
| `--shadow-raised`, `--shadow-frame`                                                        | Unchanged, in ink                                                                   |
| The semantic `--color-*` tokens and `data-tone="night"`                                    | Remapped to the new palette (above)                                                 |
| The old palette (chalk, paper, limestone, stone, basalt, night, mist, gold, timber, brick) | Removed: every reference now uses a semantic or new raw token                       |

## Console

Owner decision, 2026-11-02 (#23), unchanged by the redesign:

- **The console is built from shadcn/ui components** (`src/components/admin/ui/`,
  added with the shadcn CLI from `components.json`; `cn` is in
  `src/lib/admin/utils.ts`). User-facing strings come from
  `src/lib/admin/messages.ts`; colour literals and layout transitions are
  removed from generated files
- **Navigation is the shadcn `Sidebar` with `collapsible="icon"`**, with the
  off-canvas sheet below `md`
- **System font** (`--font-system`), its own radii and type sizes:
  `--console-radius-*` (2, 4, 8, 16 px) and `--console-text-*` (13, 15,
  17 px) in `tokens.css`. `admin.css` points the shared names (`--radius-*`,
  `--text-eyebrow`, `--text-small`, `--text-body`) at them, so the public
  site's square corners and reference type never reach the console
- **Shared colours:** `admin.css` maps every shadcn variable onto the
  semantic tokens; there is no second palette and no dark mode

| shadcn variable                                    | Token                                      |
| -------------------------------------------------- | ------------------------------------------ |
| `--background`                                     | `--color-surface`                          |
| `--foreground`, `--*-foreground` on light surfaces | `--color-text`                             |
| `--card`, `--popover`, `--sidebar-accent`          | `--color-surface-raised`                   |
| `--secondary`, `--muted`, `--accent`, `--sidebar`  | `--color-surface-alt`                      |
| `--muted-foreground`                               | `--color-text-muted`                       |
| `--primary`, `--sidebar-primary`                   | `--color-action`                           |
| `--primary-foreground`                             | `--color-action-text`                      |
| `--destructive`                                    | `--color-error`                            |
| `--input`                                          | `--color-border-strong`                    |
| `--border`, `--sidebar-border`                     | `--color-border`                           |
| `--ring`, `--sidebar-ring`                         | `--color-focus`                            |
| `text-xs` / `sm` / `base` / `lg`                   | `--console-text-*` / `--text-legacy-title` |
| `font-semibold`                                    | `--font-weight-medium`                     |
| `rounded-*`; `shadow-sm` / `md` / `lg`             | `--console-radius-*`; `--shadow-raised`    |

Rules:

- The focus ring is the shared one (2 px `--color-focus`, offset 3 px),
  unlayered in `admin.css` so the components' `outline-none` cannot remove it
- Below `md` and on touch screens, buttons, inputs, menu items and the sidebar
  toggle are at least 44 × 44 px (`admin.css`)
- Motion is limited to opacity and transform; reduced motion turns
  transitions off. No motion primitives, Lenis or scroll effects
- Lists are built on `DataTable` (`src/components/admin/data-table`), media is
  chosen with `MediaPicker` (`src/components/admin/media`), forms use
  `useAdminForm` with the shared zod schema and `TranslatableField`; feedback
  through `sonner` toasts, `useConfirm()`, `useUnsavedChangesGuard(dirty)` and
  `undoOnFailure`
