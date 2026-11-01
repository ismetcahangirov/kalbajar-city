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
constants in `src/lib/motion/tokens.ts` (#16), so CSS transitions and the
primitives read one source. `tests/unit/motion.test.ts` keeps the two in step.

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

| Token             | Value                            | Use                              |
| ----------------- | -------------------------------- | -------------------------------- |
| `--ease-out`      | `cubic-bezier(0.16, 1, 0.3, 1)`  | Entries, settles, `CountUp`      |
| `--ease-in-out`   | `cubic-bezier(0.65, 0, 0.35, 1)` | Wipes, crossfades, menu          |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`     | Hover, press, small UI           |
| (scrubbed)        | linear progress                  | Anything tied to scroll position |

The primitives pass these strings to the Web Animations API unchanged;
`CountUp`, which animates a number, evaluates the same curve in script
(`src/lib/motion/bezier.ts`).

No spring or overshoot anywhere: stone does not bounce.

### Distances and pacing

| Token                     | Value   | Use                                                                        |
| ------------------------- | ------- | -------------------------------------------------------------------------- |
| `--motion-rise`           | `24px`  | `FadeUp` start offset                                                      |
| `--motion-stagger`        | `80ms`  | Between siblings in a group (`FadeUp`, `LineReveal`)                       |
| `--motion-stagger-image`  | `120ms` | Between images in a grid (`ImageReveal`)                                   |
| `--motion-parallax-scale` | `1.16`  | `Parallax` pre-scale, so the media's edges never show                      |
| `--motion-stagger-max`    | `6`     | Items after the sixth enter with the sixth                                 |
| `--motion-trigger`        | `85%`   | An entry starts when the element's top crosses 85 % of the viewport height |

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
`lerp: 0.1`, `wheelMultiplier: 1`, `smoothWheel: true`. Lenis and every
scrubbed primitive share one `requestAnimationFrame` loop
(`src/lib/motion/frame.ts`), never two. Same-page anchor clicks glide through
Lenis with the fixed header's offset (`scroll-padding-top`); a keyboard
activation keeps the native jump, which also moves focus (the skip link relies
on it). Lenis is imported dynamically by `SmoothScroll` in the public layout,
only when it will run.

## Per-surface motion budget

| Surface                                  | Allowed                                                                                                                                | Not allowed                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Home `/`                                 | Hero settle and `Parallax`, `FadeUp`, `LineReveal` on section headings, `ImageReveal`, `CountUp` on the stat row, one `PinnedCardZoom` | A second pinned section; more than two `Parallax` |
| Catalogue `/menziller`                   | `FadeUp` on the page head only                                                                                                         | Animating cards on filter change or load          |
| Apartment `/menziller/[slug]`            | `FadeUp` on section heads, `ImageReveal` on the first gallery image                                                                    | Anything on the plan, price or form               |
| Selector `/kompleks`                     | Hotspot highlight by opacity (`--duration-fast`)                                                                                       | Camera moves, zooms, pinned scroll                |
| About, location, progress, gallery, news | `FadeUp`, `LineReveal`, `ImageReveal`; one `Parallax` per page                                                                         | Pinned sections                                   |
| Contact `/elaqe`, privacy                | `FadeUp` on the page head                                                                                                              | Anything on the forms                             |
| Console `/admin`                         | shadcn/ui defaults limited to opacity and transform                                                                                    | Motion primitives, Lenis, scroll effects          |

On every page: at most one pinned section and two parallax layers, and no
more than one entry group running at a time in the viewport.

## Reduced motion

Every primitive checks `(prefers-reduced-motion: reduce)` before it touches
the DOM and does nothing when it matches. Turning it on mid-visit shows every
waiting entry, finishes running ones, stops the scrubbed primitives and Lenis,
and unpins `PinnedCardZoom`.

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

An entry hides content, so a failure to run it must not hide content forever,
and hiding must never touch what a visitor can already see (rule 3).

1. Server HTML has no hidden styles, and no CSS hides an entry target
2. After hydration, each primitive measures its element once. Only an element
   still entirely below the viewport is hidden, with inline styles, and
   registered for its entry; anything in or above the viewport (including
   after a restored scroll position) keeps its final state
3. Hidden elements are below the viewport, so hiding them never shows as a
   flash, and it cannot happen before the script that will reveal them runs
4. An element near the end of the page that can never reach the trigger line
   enters when the page is scrolled to its end

This replaces the planned `js-motion` class with a 3 s fallback: CSS that runs
before layout cannot know where the fold is, so it would either hide content
above the fold or need a timer to undo itself.

## Performance

- No animation library. Entries use the Web Animations API, which runs
  `opacity`, `translate`, `scale` and `clip-path` keyframes with the CSS
  easing tokens; `Parallax` and `PinnedCardZoom` write `translate`,
  `clip-path` and `opacity` from the shared frame loop, from geometry measured
  on resize (no layout reads per frame); the pin is CSS `position: sticky`
- Budget: motion JS under 40 KB gzip on the routes that load it. Measured in
  #16 (2026-11-01, `gzip -9`): the planned GSAP 3.15 core (28.3 KB) +
  ScrollTrigger (18.0 KB) + Lenis 1.3 (5.4 KB) came to 51.7 KB before any of
  our code, so GSAP was dropped. Now: all primitives 5.5 KB (4.1 KB as the
  playground's route chunk), `SmoothScroll` and the frame loop about 1 KB in
  the layout, Lenis 5.4 KB loaded only for fine pointers. About 11 KB in all
- `FadeUp`, `LineReveal`, `ImageReveal` and `CountUp` share one
  `IntersectionObserver`; elements entering in the same frame stagger together
- Primitives are client components imported where they are used, so a route
  without them does not load them. `Stat` takes a `CountUp` through its
  `numeral` slot rather than importing it, for the same reason
- No `will-change`: the browser promotes Web Animations of `opacity`,
  `translate`, `scale` and `clip-path` for their duration
- Images and video inside animated frames are sized by aspect-ratio CSS, so no
  animation causes layout shift; CLS budget stays under 0.05
- Verify with a Performance trace while scrolling the home page at 4× CPU
  throttling: no long tasks from animation, no layout or paint storms
