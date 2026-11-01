---
name: kalbajar-design
description: Use before building or changing any public-site UI in Kalbajar City — pages, sections, components, tokens, typography, colour, imagery, scroll effects or animation — in `src/app/**` (outside `/admin`), `src/components/**`, `src/styles/**`, `src/lib/motion/**`, `*.tsx`, `*.css`. Also when the work says "dizayn", "səhifə", "bölmə", "komponent", "animasiya", "hərəkət", "scroll effekti", "hero", "Pinterest kimi", "premium hiss", "rəng", "şrift". Applies the stone-and-timber direction derived from the Pinterest reference and the rules in docs/ui-kit.md and docs/motion-system.md. The admin console's look (shadcn/ui, system font) is out of scope except for shared colour tokens and the focus ring.
---

# Kalbajar City design

The public site is a quiet frame around real photography of a mountain town:
pale limestone surfaces, basalt text, warm timber, one restrained gold accent,
large light-weight Alethia Next headlines with a lot of air, a slow inertial
scroll and one pinned moment per page that carries the drama.

## Sources, in order of precedence

| Source                                                                             | Status                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `CLAUDE.md` → Product constraints (Design, Imagery, Responsiveness, Accessibility) | Wins every conflict                                                  |
| [`docs/ui-kit.md`](../../../docs/ui-kit.md)                                        | Canonical: colour, type, spacing, shape, imagery, components         |
| [`docs/motion-system.md`](../../../docs/motion-system.md)                          | Canonical: motion rules, tokens, primitives, budgets, reduced motion |
| [`references/motion-recipes.md`](references/motion-recipes.md)                     | How each primitive is built: Web Animations API, sticky pin, Lenis   |
| [`references/reference-pin.md`](references/reference-pin.md)                       | The measured Pinterest reference and the take/leave table            |
| The Pinterest pin itself                                                           | Vocabulary only. Never open it to copy colours, copy or proportions  |

Read both docs before writing UI. This file is the checklist, not the source of
values: when a number is needed, take it from the docs, which name every token.

## Visual language, in short

- Surfaces alternate `paper` and `limestone`; at most one `night` section per
  page plus the footer. Components use semantic tokens (`--color-surface`,
  `--color-text`, `--color-text-muted`, `--color-action`, `--color-focus` …),
  never the raw palette and never a literal
- `gold` is decoration on light surfaces (2.8 : 1). Gold that must be read is
  `gold-deep` on light, `gold` or `gold-light` on `night`. One gold element per
  viewport on light surfaces
- One family: Alethia Next, Light for display and headings, Regular for body,
  Medium for eyebrows, buttons and labels, Italic for one emphasised phrase.
  It is a sans with old-style, proportional figures: right-align numbers
- Body never under 17 px. Headings use the fluid `display-xl` / `display` /
  `heading` / `title` steps; `as` and `size` are separate props
- Rhythm: `--spacing-section` between sections, `--spacing-block` inside;
  alternate left-aligned and centred section heads
- Shape: cut stone. `--radius-md` (8 px) on images and cards, pills for
  buttons, shadows rare
- Imagery: real photos of the complex from the owner. Generated images are
  atmosphere only and carry the `Illustrative` chip. Aspect ratios are CSS, so
  nothing shifts

## Motion, in short

| Pattern in the reference                 | Primitive         | Where                                   |
| ---------------------------------------- | ----------------- | --------------------------------------- |
| Text and blocks rising into place        | `FadeUp`          | Every block entry, everywhere           |
| Section headline arriving                | `LineReveal`      | Display headings below the fold         |
| Image grid entering                      | `ImageReveal`     | Grids, collages, single feature images  |
| Hero image slower than the page          | `Parallax` (hero) | Hero; one more full-bleed image at most |
| Pinned full-bleed scene with framed card | `PinnedCardZoom`  | Home, once                              |
| Stat row                                 | `CountUp`         | Stat rows                               |
| Inertial scroll                          | Lenis             | Public routes, `pointer: fine` only     |

- Only `transform`, `opacity` and `clip-path` animate. Colour changes are
  instant
- `FadeUp` is the one scroll-entry; `LineReveal` and `ImageReveal` are that
  entry for headings and images. No other entry, no per-component variants
- Nothing above the fold starts hidden; the hero headline never animates in
- Forms, filters and the inquiry flow never animate
- No springs, no overshoot. Easing `--ease-out` for entries, `--ease-in-out`
  for wipes and crossfades, linear for anything scrubbed
- Reduced motion and no-JS both render the final state; pinned sections become
  a stacked list
- Respect the per-surface budget table in `docs/motion-system.md`

## Checklist before opening a pull request

- [ ] No colour, size, radius, shadow, duration or easing literal outside
      `src/styles/tokens.css` (and `src/lib/motion/tokens.ts` for motion)
- [ ] Every text/surface pair used is in the contrast table, or added to it
      with a measured ratio ≥ 4.5 (≥ 3 for large text and non-text UI)
- [ ] No user-facing string hard-coded; az, en and ru all render without
      overflow (Russian runs longest)
- [ ] 320, 390, 768, 1024, 1440, 1920 px: no horizontal scroll; screenshots at
      390 and 1440 in the PR
- [ ] Touch targets ≥ 44 × 44 px; visible focus on every interactive element;
      status badges show their word
- [ ] Only allowed primitives for this surface; nothing above the fold hidden
- [ ] Reload with reduced motion emulated and with JavaScript disabled: all
      content visible in its final state
- [ ] Performance trace while scrolling at 4× CPU throttle: no long tasks from
      animation, no layout or paint per frame; CLS < 0.05
- [ ] Generated images, if any, are atmosphere only and captioned
      `Illustrative`
