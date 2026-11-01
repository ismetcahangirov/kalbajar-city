# Motion system

How the public site moves. Visual tokens live in [`ui-kit.md`](ui-kit.md); the
measured reference is in
[`.claude/skills/kalbajar-design/references/reference-pin.md`](../.claude/skills/kalbajar-design/references/reference-pin.md);
implementation recipes are in
[`.claude/skills/kalbajar-design/references/motion-recipes.md`](../.claude/skills/kalbajar-design/references/motion-recipes.md).

The reference's character, and ours: a slow, inertial scroll; short, quiet
entries; one pinned moment that carries the drama. Motion explains structure
(what arrived, what belongs together, where the next thing is). It never
decorates a form, delays content, or competes with a photograph.

## Rules

1. **Only `transform`, `opacity` and `clip-path` animate.** No width, height,
   top, margin, colour, filter, or box-shadow transitions. Colour changes on
   hover are instant, or an overlay's opacity fades
2. **One scroll-entry.** `FadeUp` is the entry for every block. Images enter
   with `ImageReveal` and display headings with `LineReveal`: these are the
   same entry rendered for those two content types, with the same trigger, the
   same once-only rule and the same timing family. Nothing else may introduce
   an entry animation, and no component gets its own variant. A new entry is a
   design change to this document first
3. **Nothing above the fold starts hidden.** The hero headline, the hero image
   and anything visible at first paint render in their final state; they may
   only move from visible (a settle, never a reveal). This protects LCP
4. **Forms and the inquiry flow do not animate.** Inputs, validation messages,
   filter results, the inquiry dialog content, success and error states appear
   instantly
5. **Reduced motion is the final state.** With `prefers-reduced-motion:
reduce`, every primitive renders its end state, Lenis does not start, video
   does not autoplay and pinned sections become a static list
6. **No JavaScript is the final state too.** Elements are hidden for an entry
   only after the motion script has loaded (see "Hidden-until-ready")
7. **Entries run once.** Scrolling back up does not replay them

## Tokens

CSS custom properties in `src/styles/tokens.css` (#15) and the same values as
constants in `src/lib/motion/tokens.ts` (#16), so CSS transitions and GSAP
read one source.

### Durations

| Token                  | Value    | Use                                                   |
| ---------------------- | -------- | ----------------------------------------------------- |
| `--duration-fast`      | `200ms`  | Hover and press feedback, icon rotation, header layer |
| `--duration-base`      | `400ms`  | UI changes: mobile menu, overlays                     |
| `--duration-crossfade` | `600ms`  | Hero poster → video, carousel image changes           |
| `--duration-reveal`    | `900ms`  | `FadeUp`, `LineReveal`                                |
| `--duration-wipe`      | `1200ms` | `ImageReveal`                                         |
| `--duration-count`     | `1600ms` | `CountUp`                                             |
| `--duration-settle`    | `2400ms` | Hero media settle on load                             |

### Easings

| Token             | Value                            | GSAP equivalent | Use                              |
| ----------------- | -------------------------------- | --------------- | -------------------------------- |
| `--ease-out`      | `cubic-bezier(0.16, 1, 0.3, 1)`  | `expo.out`      | Entries, settles, `CountUp`      |
| `--ease-in-out`   | `cubic-bezier(0.65, 0, 0.35, 1)` | `power3.inOut`  | Wipes, crossfades, menu          |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`     | `power2.out`    | Hover, press, small UI           |
| (scrubbed)        | linear progress                  | `none`          | Anything tied to scroll position |

No spring or overshoot anywhere: stone does not bounce.

### Distances and pacing

| Token                    | Value   | Use                                                                        |
| ------------------------ | ------- | -------------------------------------------------------------------------- |
| `--motion-rise`          | `24px`  | `FadeUp` start offset                                                      |
| `--motion-stagger`       | `80ms`  | Between siblings in a group (`FadeUp`, `LineReveal`)                       |
| `--motion-stagger-image` | `120ms` | Between images in a grid (`ImageReveal`)                                   |
| `--motion-stagger-max`   | `6`     | Items after the sixth enter with the sixth                                 |
| `--motion-trigger`       | `85%`   | An entry starts when the element's top crosses 85 % of the viewport height |

The reference's own fades last about 100–500 ms (counted from a 30 fps
recording, see the reference file). Ours are longer by choice: a calmer,
more expensive feel. These durations are design decisions, not measurements;
tune them in #16 by eye and by trace, then update this table.

## Primitives

Built in #16. Each is a client component that wraps server-rendered content
and does nothing when motion is off.

| Primitive        | What it does                                                                                                                                                                                                                                                                                                                                       | Timing                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `FadeUp`         | Opacity 0 → 1 and `translateY(--motion-rise)` → 0. Children of a `FadeUp group` stagger                                                                                                                                                                                                                                                            | `--duration-reveal`, `--ease-out`, stagger `--motion-stagger`        |
| `LineReveal`     | Display headings only. Split into lines after fonts load; each line sits in a clip and rises from `yPercent 105` → 0. Re-splits on resize. The heading's text stays one accessible string                                                                                                                                                          | `--duration-reveal`, `--ease-out`, stagger `--motion-stagger`        |
| `ImageReveal`    | Frame `clip-path: inset(100% 0 0 0)` → `inset(0)` (a wipe upward) while the image inside scales 1.12 → 1                                                                                                                                                                                                                                           | `--duration-wipe`, `--ease-in-out`, stagger `--motion-stagger-image` |
| `Parallax`       | Media inside an overflow-clipped frame moves on scroll: `yPercent -8` → `8`, image pre-scaled 1.16 so edges never show. Hero variant: the media moves at half the scroll speed while content rises over it (the reference's 1.9–2.4 s)                                                                                                             | Scrubbed, linear                                                     |
| `PinnedCardZoom` | The section pins. A full-bleed scene shows a framed card (`ImageFrame`) with the next scene inside. Scrolling grows the card: the next scene's layer goes from `clip-path: inset(<card rect> round 8px)` to `inset(0 round 16px)`, the frame fades out over the first 30 %, the caption crossfades at 50 %. Then the next card appears. 3–4 scenes | Scrubbed, 100 vh of scroll per scene, `scrub: 0.6` smoothing         |
| `CountUp`        | Stat numerals count from 0 to their value, formatted with `Intl.NumberFormat` for the locale. The final value is rendered invisibly underneath to reserve width (Alethia has no tabular figures); assistive tech reads only the final value                                                                                                        | `--duration-count`, `--ease-out`, starts at `--motion-trigger`       |

UI transitions that are not primitives (CSS only, no GSAP):

| Element           | Motion                                                                                                                      | Timing                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Hero media        | Visible from first paint; settles from `scale(1.06)` to `scale(1)`. Video fades in over the poster once it can play through | `--duration-settle` / `--duration-crossfade` |
| Header background | A background layer's opacity 0 → 1 when the hero leaves                                                                     | `--duration-fast`, `--ease-standard`         |
| Mobile menu       | `clip-path: inset(0 0 100% 0)` → `inset(0)`; items do not stagger                                                           | `--duration-base`, `--ease-in-out`           |
| Image hover       | Image inside its frame `scale(1)` → `scale(1.04)`                                                                           | `700ms`, `--ease-out`                        |
| Link underline    | `scaleX(0)` → `scaleX(1)` from the left                                                                                     | `--duration-fast`, `--ease-standard`         |
| Button press      | `scale(0.98)` while pressed                                                                                                 | `--duration-fast`                            |
| Accordion icon    | Plus rotates 45°; the panel itself opens instantly (`<details>`)                                                            | `--duration-fast`                            |
| Carousel          | Crossfade between images; no autoplay                                                                                       | `--duration-crossfade`, `--ease-in-out`      |

## Smooth scroll

Lenis, on public routes only, and only when `(pointer: fine)` matches and
reduced motion is off. Touch devices keep native scrolling. Settings:
`lerp: 0.1`, `wheelMultiplier: 1`, `smoothWheel: true`. Lenis drives
ScrollTrigger through one shared `requestAnimationFrame` (GSAP's ticker), never
two loops. Anchor links and `scrollIntoView` go through Lenis so the fixed
header offset (`--header-height`) is respected.

## Per-surface motion budget

| Surface                                  | Allowed                                                                                                                                | Not allowed                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Home `/`                                 | Hero settle and `Parallax`, `FadeUp`, `LineReveal` on section headings, `ImageReveal`, `CountUp` on the stat row, one `PinnedCardZoom` | A second pinned section; more than two `Parallax` |
| Catalogue `/menziller`                   | `FadeUp` on the page head only                                                                                                         | Animating cards on filter change or load          |
| Apartment `/menziller/[slug]`            | `FadeUp` on section heads, `ImageReveal` on the first gallery image                                                                    | Anything on the plan, price or form               |
| Selector `/kompleks`                     | Hotspot highlight by opacity (`--duration-fast`)                                                                                       | Camera moves, zooms, pinned scroll                |
| About, location, progress, gallery, news | `FadeUp`, `LineReveal`, `ImageReveal`; one `Parallax` per page                                                                         | Pinned sections                                   |
| Contact `/elaqe`, privacy                | `FadeUp` on the page head                                                                                                              | Anything on the forms                             |
| Console `/admin`                         | shadcn/ui defaults limited to opacity and transform                                                                                    | GSAP, Lenis, scroll effects                       |

On every page: at most one pinned section and two parallax layers, and no
more than one entry group running at a time in the viewport.

## Reduced motion

`gsap.matchMedia()` with `(prefers-reduced-motion: no-preference)` creates the
animations; the `reduce` branch creates none. In CSS, the hidden-until-ready
styles apply only under `no-preference`.

| Primitive        | Reduced-motion rendering                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| `FadeUp`         | Content visible, no offset                                                  |
| `LineReveal`     | Heading as plain text, not split                                            |
| `ImageReveal`    | Image visible, unclipped, scale 1                                           |
| `Parallax`       | Media static, centred on its focus point                                    |
| `PinnedCardZoom` | No pin: each scene stacked as a full-width image with its caption and chips |
| `CountUp`        | Final value only                                                            |
| Hero             | Poster image; video does not autoplay (also skipped when `Save-Data` is on) |
| UI transitions   | Instant                                                                     |

The Playwright suite runs once with `reducedMotion: "reduce"` and asserts all
content is in its final state (#16).

## Hidden-until-ready

An entry hides content, so a failure to run it must not hide content forever.

1. Server HTML has no hidden styles
2. An inline script in `<head>` adds `js-motion` to `<html>` before first paint,
   only when reduced motion is off
3. CSS hides entry targets only under `html.js-motion` and
   `(prefers-reduced-motion: no-preference)`, and never above the fold (rule 3)
4. If the motion bundle has not initialised 3 s after `DOMContentLoaded`, the
   class is removed and everything shows

## Performance

- GSAP, ScrollTrigger and Lenis are imported dynamically by the motion
  provider on public routes that use them; the console never loads them
- Budget: motion JS under 40 KB gzip on the routes that load it (#16).
  Estimate, to be measured in #16: GSAP core ≈ 27 KB, ScrollTrigger ≈ 12 KB,
  Lenis ≈ 4 KB, about 43 KB together, so slightly over before any of our own
  code. #16 measures the real figure and either trims (tree-shaken imports, a
  small in-house line splitter for `LineReveal` instead of SplitText) or brings
  the evidence for a higher budget
- `FadeUp` and `ImageReveal` targets are registered with `ScrollTrigger.batch`,
  not one trigger per element
- `will-change` is set only while an animation runs and removed after
- Images and video inside animated frames are sized by aspect-ratio CSS, so no
  animation causes layout shift; CLS budget stays under 0.05
- Verify with a Performance trace while scrolling the home page at 4× CPU
  throttling: no long tasks from animation, no layout or paint storms
