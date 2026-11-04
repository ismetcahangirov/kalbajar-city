---
name: kalbajar-design
description: Use before building or changing any public-site UI in Kalbajar City — pages, sections, scenes, components, tokens, themes, typography, colour, grid lines, imagery, scroll effects, hovers or animation — in `src/app/**` (outside `/admin`), `src/components/**`, `src/styles/**`, `src/lib/motion/**`, `*.tsx`, `*.css`. Also when the work says "dizayn", "səhifə", "bölmə", "səhnə", "komponent", "animasiya", "hərəkət", "scroll effekti", "hero", "pyzhevsky kimi", "referans kimi", "premium hiss", "rəng", "şrift", "tema". Applies the pyzhevsky.ru direction (curtain and cream themes, giant spread words, grid lines, pinned scenes, blur-by-lines reveals) with the rules in docs/ui-kit.md and docs/motion-system.md. The admin console's look (shadcn/ui, system font) is out of scope except for shared colour tokens and the focus ring.
---

# Kalbajar City design

The public site copies the system of https://pyzhevsky.ru/, never its
content: a dark curtain gradient and warm cream pages, five section themes,
giant caps words spread edge to edge, hairline grid lines as the skeleton,
square corners, pages built as stacks of pinned scenes that slide over each
other, and text that arrives line by line out of a blur. Everything is set in
Alethia Next.

## Sources, in order of precedence

| Source                                                                             | Status                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `CLAUDE.md` → Product constraints (Design, Imagery, Responsiveness, Accessibility) | Wins every conflict                                                                   |
| [`docs/ui-kit.md`](../../../docs/ui-kit.md)                                        | Canonical: palette, themes, contrast, type, grid, spacing, shape, imagery, components |
| [`docs/motion-system.md`](../../../docs/motion-system.md)                          | Canonical: motion rules, tokens, scene engine, the catalogue, budgets, reduced motion |
| [`references/pyzhevsky-home.md`](references/pyzhevsky-home.md)                     | The measured home page: tokens, sections S0–S10, animations A1–A43, mobile            |
| [`references/pyzhevsky-pages.md`](references/pyzhevsky-pages.md)                   | The measured chrome, inner pages, hover, focus and form states                        |
| [`references/motion-recipes.md`](references/motion-recipes.md)                     | How the engine and primitives are built and used                                      |
| The redesign spec `docs/superpowers/specs/2026-11-04-pyzhevsky-redesign-design.md` | What is copied, what is not, and which scene each of our sections becomes             |
| [`docs/redesign/README.md`](../../../docs/redesign/README.md)                      | Status, order and the brief for each remaining redesign issue; reference screenshots  |
| pyzhevsky.ru itself                                                                | System only. Never take its renders, photos, copy, logo, map art or typefaces         |

Read both docs before writing UI. This file is the checklist, not the source
of values: when a number is needed, take it from the docs or the reference
files, which name every token and every measurement.

## Visual language, in short

- **Themes:** a section sets `data-theme` (`light`, `dark`, `darker`,
  `dark-alt`, `sand`); components read `--t-bg`, `--t-text`, `--t-heading`,
  `--t-primary`, `--t-secondary`, `--t-small`, `--t-line`, `--t-line-alt`,
  `--t-control` and never branch on the theme. `--t-heading`, `--t-primary`
  and `--t-secondary` are for text ≥ 24 px only; small text is `--t-text` or
  `--t-small`. The current components still use the semantic `--color-*`
  tokens until their page is rebuilt
- **Curtain:** `--gradient-curtain` (ink → umber over 100svh) behind the hero,
  preloader, page transition and catalogue. Small sand text only in its top
  70svh
- **Type:** Alethia Next only. `--text-word` giant words (Light, caps,
  letters spread with `SplitWord`), `--text-numeral`, `--text-title` (caps,
  .1em), `--text-lead-lg` / `--text-lead` (Light), `--text-body` (never under
  15 px), `--text-small-t`, `--text-label` / `--text-label-xs` (Medium, caps,
  .2em, never under 10 px). Text is trimmed to cap height
- **Grid:** 12 full-bleed columns (6 under 668 px), `px-layout` padding,
  spacing in multiples of `--u` (`pt-u6`, `pt-u9`, `pt-u12` …), `GridLines`
  at 50 %, thirds, quarters or 25/75
- **Shape:** radius 0; only round icon buttons are round. Borders 1 px. One
  shadow, on the fixed round button
- **Imagery:** every image slot has a bundled default (Instagram
  @kalbajar.city, or generated atmosphere) that the console overrides.
  Generated images are atmosphere only and carry the `Illustrative` chip.
  Plans and apartment photos never get a default

## Motion, in short

| Pattern in the reference                        | Primitive / component                                 | Catalogue          |
| ----------------------------------------------- | ----------------------------------------------------- | ------------------ |
| Pinned scenes sliding over and away             | `Scene`, `SceneLayer`                                 | A17, A24, A25      |
| Anything tied to scroll position                | `useScrub` + `scrubEase`                              | A5–A8, A18–A28     |
| A change when a point is crossed, reversible    | `useThreshold`                                        | A11, A13, A31      |
| Lines out of a blur, image out of a blur, wipes | `Reveal` (`text`, `image-in`, `clip-down`, `clip-up`) | A11, A12, A29, A39 |
| Giant word spreading, exploding, climbing       | `SplitWord` (`spread`, `explode`, `staircase`)        | A14–A16            |
| Grid lines drawing in                           | `GridLines`                                           | A13                |
| Hero snap                                       | `useHeroSnap`                                         | A43                |
| Hover roll, conveyor, fills                     | `RollLink`, `Burger`, `ArrowBlock` …                  | A36–A38            |

- Only `transform`, `opacity`, `clip-path`, plus `filter: blur()` in `text`,
  `image-in`, `BlurSlideshow` and the `HoverList` caption swap, never on a
  full-bleed layer. Colour changes are instant or an overlay's opacity
- Every animation is an entry of the catalogue in `docs/motion-system.md`,
  with its range, duration and easing. A new one is a change to that document
  first
- `--ease-out` (house), `--ease-wipe` (wipes, rolls, fills, line draws),
  `--ease-exit`, `--ease-carousel`; scrubbed progress through `linear`,
  `quadOut`, `quadIn`, `quadInOut`. No springs
- The LCP image is painted at first paint; intros wipe its clip, never its
  opacity
- Forms, filters and the inquiry flow never animate; the modal panel does
- Reduced motion: a plain stacked page in its final state. Touch and under
  668 px: native scroll, no reveals, the reference's mobile variants. No JS:
  the server HTML is the final state; nothing is hidden by CSS
- Respect the per-surface budget in `docs/motion-system.md`

## Checklist before opening a pull request

- [ ] No colour, size, radius, shadow, duration or easing literal outside
      `src/styles/tokens.css` (and `src/lib/motion/tokens.ts` for motion);
      `pnpm lint:tokens` passes
- [ ] New components read theme tokens (`--t-*`) and work on all five themes
- [ ] Every text/surface pair used is in the contrast table of
      `docs/ui-kit.md` and in `tests/unit/contrast.test.ts` (≥ 4.5, or ≥ 3 for
      text ≥ 24 px and non-text UI)
- [ ] No user-facing string hard-coded, including giant words
      (`Home.words.*`); az, en and ru render without overflow at 320 px
      (Russian runs longest)
- [ ] 320, 390, 768, 1024, 1440, 1920 px: no horizontal scroll; screenshots at
      390 and 1440 in the PR
- [ ] Touch targets ≥ 44 × 44 px (invisible hit areas around 30 px buttons,
      15 px checkboxes, range ticks and caps links); visible focus on every
      interactive element; statuses show their word
- [ ] Every animation is in the catalogue, with its values; nothing outside
      the surface's budget
- [ ] Reload with reduced motion emulated and with JavaScript disabled: all
      content visible in its final state
- [ ] Performance trace while scrolling at 4× CPU throttle: no long tasks
      from animation, no layout per frame; CLS < 0.05; LCP image visible at
      first paint; `pnpm budget:js` passes
- [ ] Nothing taken from pyzhevsky.ru's content; generated images, if any,
      are atmosphere only and captioned `Illustrative`
