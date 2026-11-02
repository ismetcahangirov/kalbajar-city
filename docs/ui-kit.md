# UI kit

The visual system of the public site. Motion lives in
[`motion-system.md`](motion-system.md). How the Pinterest reference was turned
into this system is in
[`.claude/skills/kalbajar-design/references/reference-pin.md`](../.claude/skills/kalbajar-design/references/reference-pin.md).

Every value below becomes a token in **`src/styles/tokens.css`** (a Tailwind v4
`@theme` block, built in #15). That file is the only place a colour literal,
font size, radius, shadow, duration or easing may be written. Components use
the **semantic** tokens; the raw palette exists only to define them.

The console (`/admin`) uses shadcn/ui and the system font stack. It shares the
semantic colour tokens and the focus ring, nothing else from this page; see
[Console](#console) at the end.

## Direction

Kəlbəcər is a mountain town. The site should feel like its materials: pale
limestone, dark basalt, warm timber, and one restrained gold accent for the
moments that matter. Large, light headlines with a lot of air. Real
photography does the selling; the interface stays quiet around it.

## Colour

### Palette (raw tokens)

| Token                | Value     | Role                                                   |
| -------------------- | --------- | ------------------------------------------------------ |
| `--color-chalk`      | `#FBF9F5` | Raised cards, the frame in `PinnedCardZoom`            |
| `--color-paper`      | `#F5F2EC` | Default page surface                                   |
| `--color-limestone`  | `#EAE4D9` | Alternate section surface                              |
| `--color-stone-200`  | `#D9D1C3` | Decorative hairlines and dividers only                 |
| `--color-stone-500`  | `#857B6D` | Input borders and other non-text UI that must show     |
| `--color-stone-600`  | `#655D52` | Secondary text on light surfaces                       |
| `--color-basalt`     | `#22201D` | Primary text, primary button                           |
| `--color-night`      | `#161513` | Dark sections, footer                                  |
| `--color-mist`       | `#B9B1A4` | Secondary text on dark surfaces                        |
| `--color-gold`       | `#B38B4D` | Decoration only on light; wordmark and accents on dark |
| `--color-gold-deep`  | `#7E5F2C` | Gold that must be read on light: text, focus, state    |
| `--color-gold-light` | `#D4B47C` | Gold text and focus on dark surfaces                   |
| `--color-timber`     | `#7A4E31` | Status: reserved                                       |
| `--color-moss`       | `#3F5A3C` | Status: available; success                             |
| `--color-brick`      | `#9A2E22` | Errors                                                 |

### Semantic tokens (what components use)

| Token                      | Light surface  | On `night`   |
| -------------------------- | -------------- | ------------ |
| `--color-surface`          | `paper`        | `night`      |
| `--color-surface-alt`      | `limestone`    | `basalt`     |
| `--color-surface-raised`   | `chalk`        | `basalt`     |
| `--color-text`             | `basalt`       | `paper`      |
| `--color-text-muted`       | `stone-600`    | `mist`       |
| `--color-text-accent`      | `gold-deep`    | `gold-light` |
| `--color-border`           | `stone-200`    | `stone-600`  |
| `--color-border-strong`    | `stone-500`    | `mist`       |
| `--color-action`           | `basalt`       | `paper`      |
| `--color-action-text`      | `paper`        | `basalt`     |
| `--color-accent`           | `gold` (decor) | `gold`       |
| `--color-focus`            | `gold-deep`    | `gold-light` |
| `--color-status-available` | `moss`         | —            |
| `--color-status-reserved`  | `timber`       | —            |
| `--color-status-sold`      | `stone-600`    | —            |
| `--color-error`            | `brick`        | —            |

A section switches to the dark set with `data-tone="night"`, which redefines
the semantic tokens for its subtree. Components never branch on the tone.

### Contrast (WCAG 2.2 AA)

Measured with the WCAG relative-luminance formula on 2026-11-01. The contrast
test in #15 re-checks every pair in use; a failure breaks the build.

| Pair                       | Ratio | Allowed for                      |
| -------------------------- | ----- | -------------------------------- |
| `basalt` on `paper`        | 14.54 | all text                         |
| `basalt` on `limestone`    | 12.84 | all text                         |
| `stone-600` on `paper`     | 5.80  | all text                         |
| `stone-600` on `limestone` | 5.12  | all text                         |
| `gold-deep` on `paper`     | 5.28  | all text, focus ring             |
| `gold-deep` on `limestone` | 4.66  | all text, focus ring             |
| `timber` on `paper`        | 6.35  | all text                         |
| `moss` on `paper`          | 6.86  | all text                         |
| `brick` on `paper`         | 6.74  | all text                         |
| `paper` on `night`         | 16.33 | all text                         |
| `mist` on `night`          | 8.59  | all text                         |
| `gold` on `night`          | 5.84  | all text, wordmark               |
| `gold-light` on `night`    | 9.23  | all text, focus ring             |
| `stone-500` on `paper`     | 3.72  | input borders, icons (non-text)  |
| `stone-500` on `limestone` | 3.29  | input borders, icons (non-text)  |
| `gold` on `paper`          | 2.80  | **decoration only**, never text  |
| `stone-200` on `paper`     | 1.36  | **decoration only**, never a cue |

Rules:

- `gold` is never text, an icon or a state indicator on a light surface. Use
  `gold-deep`
- Colour never carries meaning alone. An apartment status badge always shows
  its word; an error always shows a message and an icon
- Gold is rare: at most one gold element per viewport on light surfaces

## Typography

**Alethia Next** (Pepper Type), self-hosted WOFF2, subset to Latin, Latin
Extended and Cyrillic. It is a sans with a small x-height (480/1000) and
old-style figures; it has no `lnum` or `tnum` feature. Four styles ship on
public pages:

| Token                  | File                  | Weight | Use                                 |
| ---------------------- | --------------------- | ------ | ----------------------------------- |
| `--font-weight-light`  | `AlethiaNext-Light`   | 300    | Display and headings                |
| `--font-weight-normal` | `AlethiaNext-Regular` | 400    | Body, UI                            |
| `--font-weight-medium` | `AlethiaNext-Medium`  | 500    | Eyebrows, buttons, labels, emphasis |
| (italic)               | `AlethiaNext-Italic`  | 400 i  | One emphasised phrase in a heading  |

`--font-sans` is Alethia Next with a metric-matched Arial fallback
(`src/styles/font-fallback.css`), so the swap does not move text vertically;
centred text may move by a few pixels sideways (measured CLS 0.0002 with the
font files delayed by 800 ms). Italic is its own family, `--font-italic`,
applied to `<em>`, and is not preloaded. The console uses `--font-system`.

The font has no manat sign (`₼`): prices show the currency code `AZN`, or the
sign falls back to the system font. Use `max-w-(--container-prose)` for the
prose measure; Tailwind's `max-w-prose` is a fixed 65ch and ignores the token.

The reference pairs a serif with a sans. We do not: contrast comes from size
and weight (Light display against Regular body) and from Italic for one
phrase, such as "Dağların qoynunda _yeni ev_".

### Type scale

Fluid between 320 px and 1440 px viewports. Each step is a Tailwind `--text-*`
token with its line height, tracking and weight.

| Token        | Size                                          | Line height | Tracking | Weight | Use                             |
| ------------ | --------------------------------------------- | ----------- | -------- | ------ | ------------------------------- |
| `display-xl` | `clamp(3rem, 1.86rem + 5.71vw, 7rem)`         | 0.95        | -0.025em | 300    | Hero headline                   |
| `display`    | `clamp(2.25rem, 1.71rem + 2.68vw, 4.125rem)`  | 1.05        | -0.02em  | 300    | Section headings (h2)           |
| `heading`    | `clamp(1.5rem, 1.29rem + 1.07vw, 2.25rem)`    | 1.15        | -0.01em  | 300    | Sub-headings (h3), card titles  |
| `title`      | `clamp(1.125rem, 1.05rem + 0.36vw, 1.375rem)` | 1.3         | 0        | 400    | Small headings (h4), list items |
| `stat`       | `clamp(2.5rem, 2.07rem + 2.14vw, 4rem)`       | 1           | -0.02em  | 300    | `Stat` numerals                 |
| `body-lg`    | `clamp(1.125rem, 1.09rem + 0.18vw, 1.25rem)`  | 1.6         | 0        | 400    | Lead paragraphs                 |
| `body`       | `1.0625rem` (17 px)                           | 1.6         | 0        | 400    | Body text                       |
| `small`      | `0.9375rem` (15 px)                           | 1.5         | 0        | 400    | Captions, meta, helper text     |
| `eyebrow`    | `0.8125rem` (13 px)                           | 1.4         | 0.14em   | 500    | Eyebrows, uppercase             |
| `wordmark`   | `min(100cqi / 6, 15rem)`                      | 0.9         | -0.03em  | 300    | Footer wordmark, fits the width |

Rules:

- Body text never goes below 17 px: the small x-height reads small
- Measure: body at most `--container-prose` (40 rem, about 70 characters)
- One `h1` per page. Visual size and heading level are independent props
- Numerals are old-style and proportional. Right-align numbers in tables and
  lists so the units line up; never fake lining figures with another font
- The wordmark size is derived from a measurement: "Kalbajar City" in Alethia
  Next Light at -0.03em tracking is 5.91 em wide, so dividing the available
  width by 6 fits it with about 1.5 % to spare. The width is the `Wordmark`
  wrapper's (`100cqi`, an inline-size container), not the viewport's: `100vw`
  counts a classic scrollbar, and at 320 px that overflowed the container by
  10 px (measured 2026-11-01). Re-measure when the text or the logo changes
- Azerbaijani text is set with `lang="az"` so `İ`/`i` and `I`/`ı` case
  correctly under `uppercase`. Eyebrows in Russian keep the same tracking

## Spacing and layout

The Tailwind base (`--spacing: 0.25rem`) stays. Named rhythm tokens on top:

| Token               | Value                                     | Use                                      |
| ------------------- | ----------------------------------------- | ---------------------------------------- |
| `--spacing-gutter`  | `clamp(1rem, 0.571rem + 2.143vw, 2.5rem)` | Page side padding, grid gap              |
| `--spacing-block`   | `clamp(2rem, 1.429rem + 2.857vw, 4rem)`   | Between blocks inside a section          |
| `--spacing-section` | `clamp(5rem, 3.571rem + 7.143vw, 10rem)`  | Between sections                         |
| `--container-page`  | `90rem` (1440 px)                         | Page container max width, inside gutters |
| `--container-prose` | `40rem`                                   | Long text                                |
| `--header-height`   | `4.5rem` mobile, `5.5rem` from `lg`       | Fixed header; anchors offset by it       |

Grid: 4 columns below `md`, 8 from `md`, 12 from `lg`, gap `--spacing-gutter`.
Full-bleed media breaks out of the container; text never does.

Breakpoints are Tailwind's defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280,
`2xl` 1536). Verify at 320, 390, 768, 1024, 1440 and 1920 px: no horizontal
scroll at any of them.

Section rhythm: alternate `paper` and `limestone` surfaces, and alternate
left-aligned and centred section heads. One `night` section per page at most,
plus the footer.

## Shape and depth

| Token             | Value                                                                    | Use                                    |
| ----------------- | ------------------------------------------------------------------------ | -------------------------------------- |
| `--radius-xs`     | `2px`                                                                    | Chips, badges                          |
| `--radius-sm`     | `4px`                                                                    | Inputs, select, textarea, checkbox     |
| `--radius-md`     | `8px`                                                                    | Images in grids, cards                 |
| `--radius-lg`     | `16px`                                                                   | Large framed media, the pinned section |
| `--radius-full`   | `9999px`                                                                 | Buttons, the mobile action bar         |
| `--shadow-raised` | `0 1px 2px rgb(22 21 19 / 0.06), 0 12px 32px -16px rgb(22 21 19 / 0.18)` | Raised cards, the open mobile menu     |
| `--shadow-frame`  | `0 24px 64px -24px rgb(22 21 19 / 0.45)`                                 | The framed card in `PinnedCardZoom`    |

Radii are smaller than the reference's: cut stone, not pebbles. Shadows are
rare; most separation comes from surface colour and space.

## Imagery

- Real photos, renders and video come from the owner. Generated images are
  atmosphere only (landscape, materials, interior mood) and follow
  CLAUDE.md → Imagery
- A generated image shows an `Illustrative` caption chip (`media.illustrative`
  in the catalogues) wherever it could be read as the real complex
- Every image has a focus point from the media library, used for
  `object-position`, and a blur placeholder
- Aspect ratios: hero 16 : 9 (desktop) / 4 : 5 (mobile, art-directed crop),
  grid 4 : 3, portrait 3 : 4, pinned scene 16 : 9. Ratios are set by CSS, so
  images never shift layout
- No filters, overlays or duotones on photos. A scrim gradient from `night` at
  0 % → 55 % opacity is allowed under text on the hero only

## Iconography

`lucide-react`, stroke width 1.5, sizes 20 px (inline) and 24 px (stand-alone),
colour `currentColor`. Icon-only buttons carry an accessible name. Icons
support a label; they never replace one.

## Focus, targets and states

- Focus ring: 2 px solid `--color-focus`, offset 3 px, on every interactive
  element, via `:focus-visible`. Never removed
- Touch targets: at least 44 × 44 px, including the hit area of inline links in
  dense lists and the locale switcher
- Hover never carries information that focus and touch lack
- Colour does not transition (see motion-system: only `transform`, `opacity`
  and `clip-path` animate). A hover that changes colour changes it instantly,
  or fades an overlay's opacity
- Disabled: 45 % opacity plus `aria-disabled`; never the only signal of why

## Components

Built in #15 unless noted. Names are the React component names.

| Component                     | Anatomy and variants                                                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Container`                   | Max `--container-page`, side padding `--spacing-gutter`. `size="prose"` for long text                                                                                                                                |
| `Section`                     | Vertical padding `--spacing-section`; `tone`: `paper` · `limestone` · `night`; optional `id` for anchors                                                                                                             |
| `Eyebrow`                     | `eyebrow` text, uppercase, `--color-text-accent`                                                                                                                                                                     |
| `Heading`                     | `as` (h1–h4) and `size` (`display-xl` · `display` · `heading` · `title`) are separate; `align`: start · center; supports one `<em>` rendered in Italic                                                               |
| `Text`                        | `size`: `body-lg` · `body` · `small`; `tone`: default · muted                                                                                                                                                        |
| `Button`                      | `primary` (`action` fill, pill), `secondary` (1 px `border-strong` outline, pill), `link` (underlined text); sizes `md` (48 px tall) · `lg` (56 px); optional leading/trailing icon; renders `<a>` when given `href` |
| `Card`                        | Media (aspect ratio prop) + optional chip row + `title` + `small` meta; whole card is one link when it has `href`                                                                                                    |
| `Badge`                       | Apartment status: dot + word (`Satışda` / `Rezerv` / `Satılıb` via catalogue), `--radius-xs`; also neutral and `Illustrative` variants                                                                               |
| `Chip`                        | Spec chip: icon + value (`62,09 m²`, `2 otaq`), on `chalk` at 90 % or on image with a `night` 60 % backing                                                                                                           |
| `Stat`                        | `stat` numeral + `small` label; value is a number plus unit and is formatted per locale; animates with `CountUp`                                                                                                     |
| `Input`, `Select`, `Textarea` | Label above (always visible), 48 px tall, `--radius-sm`, 1 px `border-strong`, helper or error text below with an icon; error sets `aria-invalid` and `aria-describedby`                                             |
| `Checkbox`                    | 24 px box, 44 px hit area, label to the right, consent text may contain a link                                                                                                                                       |
| `Icon`                        | Wrapper over lucide with the two sizes and `aria-hidden` unless labelled                                                                                                                                             |
| `Header`                      | Fixed. Over the hero: transparent, `paper` text. After the hero leaves: `surface` background layer fades in. Wordmark, primary nav, locale switcher (`AZ · EN · RU`), call CTA                                       |
| `MobileMenu`                  | Full screen on `night`, focus-trapped, closes on route change and Escape; nav items at `heading` size; contacts at the bottom                                                                                        |
| `MobileActionBar`             | Fixed bottom bar below `lg`: Call and WhatsApp, each half width, 56 px tall, respects `env(safe-area-inset-bottom)`                                                                                                  |
| `Footer`                      | `night`. Contacts, nav columns, socials, legal; closes on `Wordmark`                                                                                                                                                 |
| `Wordmark`                    | "Kalbajar City" typeset in `wordmark` size, `gold` on `night`, fitted to the container width; replaced by the vector logo when the owner supplies it                                                                 |
| `ImageFrame`                  | `chalk` border of 10 px (12 px from `lg`), `--radius-md`, `--shadow-frame`; the card in `PinnedCardZoom`                                                                                                             |
| `Accordion`                   | FAQ rows on native `<details>`, hairline `border` between rows, plus icon rotates (page issue #17)                                                                                                                   |
| `ProcessStep`                 | Large `stat` numeral `01`–`04` in Light, `title`, `body` (page issue #17)                                                                                                                                            |

## Home page composition

The order follows the spec (§4) and the reference's rhythm:

1. Hero: full-bleed media, `display-xl` headline, one primary and one
   secondary action, a row of spec chips at the foot
2. Stats: area, apartments, underground parking, buildings
3. About: eyebrow, heading, lead text, an image collage
4. Featured layouts: cards per layout type
5. Amenities: a grid of images with captions, `ImageReveal`
6. Pinned scenes: `PinnedCardZoom`, three or four scenes
7. Location, then construction progress
8. Process: four numbered steps
9. FAQ, then the final CTA (inquiry and call-back)
10. Footer with the wordmark

Testimonials appear only when the owner provides real, attributable quotes.

## Console

Owner decision, 2026-11-02 (#23):

- **The console is built from shadcn/ui components** (`src/components/admin/ui/`,
  added with the shadcn CLI from `components.json`; `cn` is in
  `src/lib/admin/utils.ts`). Generated files are ours to edit: user-facing
  strings come from `src/lib/admin/messages.ts`, colour literals and layout
  transitions are removed
- **Navigation is the shadcn `Sidebar` with `collapsible="icon"`**: an icon
  rail on desktop (toggled by `SidebarTrigger` in the top bar, `SidebarRail`
  and `Ctrl/Cmd+B`, the state kept in the `sidebar_state` cookie, scoped to
  `/admin`), and the off-canvas sheet the component provides below `md`
- **shadcn on the public site** only where an accessible behaviour primitive is
  needed (dialog, sheet, popover), restyled with the public tokens on this
  page. Never with shadcn's default look

Theme. `src/app/admin/admin.css` maps every shadcn variable onto the semantic
tokens; there is no second palette and no dark mode (`dark:` only matches
inside a `.dark` element, which nothing renders).

| shadcn variable                                    | Token                                  |
| -------------------------------------------------- | -------------------------------------- |
| `--background`                                     | `--color-surface`                      |
| `--foreground`, `--*-foreground` on light surfaces | `--color-text`                         |
| `--card`, `--popover`, `--sidebar-accent`          | `--color-surface-raised`               |
| `--secondary`, `--muted`, `--accent`, `--sidebar`  | `--color-surface-alt`                  |
| `--muted-foreground`                               | `--color-text-muted`                   |
| `--primary`, `--sidebar-primary`                   | `--color-action`                       |
| `--primary-foreground`                             | `--color-action-text`                  |
| `--destructive`                                    | `--color-error`                        |
| `--input`                                          | `--color-border-strong`                |
| `--border`, `--sidebar-border`                     | `--color-border`                       |
| `--ring`, `--sidebar-ring`                         | `--color-focus`                        |
| `text-xs` / `sm` / `base` / `lg`                   | `eyebrow` / `small` / `body` / `title` |
| `font-semibold`                                    | `--font-weight-medium`                 |
| `rounded-xl`; `shadow-sm` / `md` / `lg`            | `--radius-lg`; `--shadow-raised`       |

shadcn's "accent" is a hover surface in the console, not the public gold.

Rules:

- The focus ring is the shared one (2 px `--color-focus`, offset 3 px). It is
  unlayered CSS in `admin.css`, so the components' `outline-none` cannot
  remove it; their own focus rings are stripped
- Below `md` and on touch screens, buttons, inputs, menu items and the sidebar
  toggle are at least 44 × 44 px (`admin.css`)
- Motion is limited to opacity and transform; the sidebar collapses without a
  width animation, and reduced motion turns transitions off
- Lists are built on `DataTable` (`src/components/admin/data-table`): a table
  from `md`, cards below, page, sort and filters in the URL
  (`?sehife=`, `?sira=`, Azerbaijani filter keys). A module declares its
  columns, filters and RTK Query endpoint and adds no layout code. A list of
  pictures passes `grid` for a thumbnail grid, the default view, with the
  table and cards as "list" (`?gorunus=siyahi`); a `kind: "text"` filter is a
  search box (`?axtar=`)
- Media is chosen with `MediaPicker` (`src/components/admin/media`): search,
  kind filter and an upload zone in a dialog, returning the chosen file.
  Uploads report progress per file and their problems in plain words
- Forms use `useAdminForm` with the shared zod schema, the field wrappers in
  `src/components/admin/form`, `TranslatableField` for `{ az, en, ru }`
  values, `applyApiErrors` for the API's `fields`. Messages are Azerbaijani;
  the schemas' and the API's English messages are never shown
- Feedback: `sonner` toasts (`toastApiError`), `useConfirm()` before
  destructive actions, `useUnsavedChangesGuard(dirty)` on forms, and
  `undoOnFailure` (`src/store/optimistic.ts`) for optimistic updates where the
  server cannot end up with something else
