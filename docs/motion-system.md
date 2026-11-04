# Motion system

How the public site moves, after https://pyzhevsky.ru/ (spec
[`2026-11-04-pyzhevsky-redesign-design.md`](superpowers/specs/2026-11-04-pyzhevsky-redesign-design.md)
§6). Visual tokens live in [`ui-kit.md`](ui-kit.md). The measured reference,
with every animation numbered A1–A43, is in
[`.claude/skills/kalbajar-design/references/pyzhevsky-home.md`](../.claude/skills/kalbajar-design/references/pyzhevsky-home.md)
(§3 sections, §4 catalogue, §5 mobile) and
[`pyzhevsky-pages.md`](../.claude/skills/kalbajar-design/references/pyzhevsky-pages.md)
(chrome, inner pages, states). Implementation recipes are in
[`.claude/skills/kalbajar-design/references/motion-recipes.md`](../.claude/skills/kalbajar-design/references/motion-recipes.md).

The reference's character, and ours: a page is a stack of pinned scenes that
slide over and away from each other; giant words spread, explode and climb
with the scroll; text arrives line by line out of a blur; images wipe and
iris open; every hover is a small, exact mechanism. Motion explains structure.
It never decorates a form, delays content, or hides what JavaScript did not
get to reveal.

## Rules

1. **Only `transform`, `opacity` and `clip-path` animate**, plus
   `filter: blur()` in exactly four places: the `text` and `image-in`
   reveals, `BlurSlideshow`, and the `HoverList` caption swap. A blurred
   element is never larger than a text block or a portrait image (never a
   full-bleed layer), so paint cost stays bounded. No width, height, top,
   margin, colour or box-shadow transitions: a colour change is instant,
   or fades as an overlay's or pseudo-element's opacity (button fills, the
   header's theme)
2. **The catalogue below is closed.** Every animation on the public site is
   one of its entries, with its trigger, range, duration and easing. A new
   animation is a design change to this document first
3. **The LCP image is painted at first paint.** The hero poster or the render
   panel image is in the server HTML and visible; an intro may wipe its
   `clip-path` or move it, never hide it with opacity. The preloader never
   delays its request
4. **Forms and the inquiry flow do not animate.** Inputs, labels, borders,
   ticks, validation messages, filter results, success and error states change
   instantly. The modal panel that holds a form wipes in; its fields do not
5. **Reduced motion is the final state.** With `prefers-reduced-motion:
reduce` every scene renders as a plain stacked page in its end state (see
   Reduced motion, touch, no JS)
6. **No JavaScript is the final state too.** Nothing is hidden by CSS before
   the motion script runs (Hidden-until-ready)
7. **Scroll-driven motion is reversible.** Scrubbed effects follow the scroll
   both ways; thresholds play their leave variant when scrolled back, as in
   the reference. Reveals on entry run once

## Tokens

CSS custom properties in `src/styles/tokens.css` and the same values as
constants in `src/lib/motion/tokens.ts`; `tests/unit/motion.test.ts` keeps the
two in step.

### Easings

| Token             | Value                              | Use                                                                 |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `--ease-out`      | `cubic-bezier(.25, .74, .22, .99)` | The house curve: reveals, links, header, modals, cards              |
| `--ease-wipe`     | `cubic-bezier(.7, 0, .4, 1)`       | Wipes, the load intro, the character roll, button fills, line draws |
| `--ease-exit`     | `cubic-bezier(.47, .04, .5, -.06)` | Blur-out, tab content out                                           |
| `--ease-carousel` | `cubic-bezier(.6, 0, .1, 1)`       | `TripleCarousel` slides                                             |

Scrubbed effects map their progress through a function in
`src/lib/motion/tokens.ts` (`scrubEase`): `linear` (the default), `quadOut`
(2t − t², the reference's `easeSection`), `quadIn` (t², `easeSectionInverse`)
and `quadInOut`. Progress is clamped to 0…1 unless an entry says unclamped.

No spring or overshoot anywhere; `--ease-exit` dips just below 0 at its end by
design (the reference's curve).

### Durations and staggers

| Token                | Value    | Use                                                               |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `--duration-fast`    | `200ms`  | Fades of small UI (cursor followers, the teaser button)           |
| `--duration-normal`  | `400ms`  | Plain links, round-button hover, line draws, list icon swap, tabs |
| `--duration-button`  | `600ms`  | Character roll, underline redraw, button fills, header theme      |
| `--duration-slow`    | `800ms`  | Header collapse, menu, modals, page transition, clip-out, swap    |
| `--duration-block`   | `1400ms` | `BlurSlideshow` crossfade                                         |
| `--duration-reveal`  | `1600ms` | `text`, `image-in`, `clip-down`, `clip-up`, the load intro        |
| `--stagger-line`     | `40ms`   | Between lines of a `text` reveal                                  |
| `--stagger-glyph`    | `50ms`   | Between wordmark glyphs in the load intro                         |
| `--stagger-char`     | `10ms`   | Between tagline characters                                        |
| `--stagger-roll`     | `16ms`   | Between characters of a `RollLink` hover                          |
| `--stagger-group`    | `180ms`  | Between members of a reveal group                                 |
| `--motion-blur`      | `20px`   | Start blur of `text` and `image-in`                               |
| `--motion-blur-soft` | `10px`   | `BlurSlideshow` blur                                              |

Legacy tokens used by the current primitives (`FadeUp`, `LineReveal`,
`ImageReveal`, `Parallax`, `PinnedCardZoom`, `CountUp`, the old hero and
menu) stay until #63 replaces them: `--duration-base`, `-crossfade`,
`-entry` (900 ms), `-wipe`, `-count`, `-settle`, `--ease-in-out`,
`--ease-standard`, `--motion-rise`, `--motion-stagger`,
`--motion-stagger-image`, `--motion-parallax-scale`.

## Scene engine

Built in #63 on the existing frame loop (`src/lib/motion/frame.ts`), Lenis and
CSS `position: sticky`. No animation library is added (GSAP was measured and
dropped in #16: 46 KB gzip with ScrollTrigger).

### Scenes

A page is a sequence of `Scene`s. A scene is a CSS grid whose layers share one
cell and are `position: sticky; top: 0; height: 100svh`, so the layers pin
while the scene's taller content scrolls over them.

- `underPrevious` (margin-top −100svh) and `underNext` (margin-bottom −100svh)
  overlap a scene with its neighbour by one viewport
- Adjacent overlapping pairs are clipped with `clip-path: inset(100svh 0 0)`,
  so the next scene slides over a pinned one, or slides away and reveals the
  one underneath
- A scene carries `data-theme`; the header and fixed buttons re-theme from the
  scene under them (A10)

### Ranges

Scroll ranges use the reference's notation, `"A-B"`: point B % of the element
(0 top, 100 bottom) sits at A % of the viewport. So `100-0` is the element's
top at the viewport's bottom, `0-0` its top at the viewport's top, `0-100` its
bottom at the top (gone), `-100-0` its top one viewport above the top. A bare
length (`"90svh"`) is the moment the element's top crosses that height. A
range is a pair: `"100-0 → 0-0"`. Distances below are in viewport heights
(vh) of scroll.

### Primitives (#63)

| Primitive                                | What it does                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scene`, `SceneLayer`                    | The sticky grid above, with `underPrevious` / `underNext` and the pair clip                                                                                                                                                                                            |
| `useScrub(ref, range, ease, apply)`      | Progress through a range, from geometry measured on resize (`onMeasure`), eased and passed to `apply`, which writes `transform`, `clip-path` or `opacity`. No layout reads per frame                                                                                   |
| `useThreshold(ref, point, enter, leave)` | Toggles a state when the point is crossed and back; the CSS transition for `enter` or `leave` runs (reversible)                                                                                                                                                        |
| `Reveal`                                 | Reveal on entry: `variant` `text` · `image-in` · `clip-down` · `clip-up`; an `IntersectionObserver` with a −100 px bottom margin; a `group` reveals its children at threshold .5 with `--stagger-group` and a 30 ms delay. Desktop only (`pointer: fine` and ≥ 668 px) |
| `SplitWord`                              | The giant word (ui-kit → Components) with a scrubbed `spread`, `explode` or `staircase` animation                                                                                                                                                                      |
| `GridLines`                              | The grid lines, drawing in with `lines` on a threshold                                                                                                                                                                                                                 |
| `Swap`                                   | A span that leaves and enters through its clip (A31)                                                                                                                                                                                                                   |
| `useHeroSnap`                            | The hero snap (A43)                                                                                                                                                                                                                                                    |
| `parseRange`, `scrubEase`                | The range notation and the easings, pure and unit-tested                                                                                                                                                                                                               |

The playground `/primitivler/hereket` shows each one alone (#63 updates it).
Components built on them (`RollLink`, `Burger`, `TripleCarousel`,
`BlurSlideshow`, `HoverList`, `StatSpread` …) come with the chrome and page
PRs (#64, #66–#68).

### Time-based transitions

| Name              | Change                                                                          | Timing                                                           |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `text` (A11)      | Per line: `blur(--motion-blur)`, opacity 0, `translateY(100%)` → sharp, at rest | `--duration-reveal` `--ease-out`, `--stagger-line`; out reverses |
| `image-in` (A12)  | `blur(--motion-blur)`, opacity 0 → clear                                        | `--duration-reveal` `--ease-out`                                 |
| `clip-down` (A39) | `inset(0 0 100% 0)` → `inset(0)`                                                | `--duration-reveal` in / `--duration-slow` out, `--ease-wipe`    |
| `clip-up` (A29)   | `inset(100% 0 0 0)` → `inset(0)`                                                | `--duration-reveal` in / `--duration-slow` out, `--ease-wipe`    |
| `lines` (A13)     | Grid lines `scaleY(0)` → 1, alternating origin (top, bottom)                    | `--duration-slow` `--ease-wipe`; reversible                      |
| `swap` (A31)      | Span `translateY(±140%)` inside a clip                                          | `--duration-slow` `--ease-wipe`; leave +200 ms, enter +400 ms    |

`text` splits into measured lines after fonts load and re-splits on resize;
the element keeps one accessible string. Start states are applied only by
script, after hydration, to elements below the viewport.

### Per-letter word animations (`SplitWord`)

Scrubbed; offsets are computed from the letter count `n` and the letter's
index `i`, so any word in any locale works.

| Animation   | Reference | Change                                                                                                                                                              | Range, ease                                                |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `spread`    | A14       | Letters start bunched toward the centre and spread to the edges: outer letters ±20vw, inner ±10vw, linear in between (the reference's "ОКНА": +20, +10, −10, −20vw) | Section top from viewport bottom to top (~1 vh), `quadOut` |
| `explode`   | A15       | Letters fly outward from the centre, left half negative, right half positive, ±7.5vw for the innermost to ±37.5vw for the outermost, 5vw apart                      | `-150-0 → -250-0` (1 vh), `quadIn`                         |
| `staircase` | A16       | Letter `i` rises from `translateY((i + 1) · 2vw)` to 0 out of the word's clip                                                                                       | Section top from viewport bottom to 25 %, `quadIn`         |

## Scroll-effect catalogue

The reference's animations, numbered as in `pyzhevsky-home.md` §4, with their
exact ranges and values at 1440 × 900. Ours are mapped onto our sections in
spec §7.2. "Load" runs once after the preloader hides.

### Hero and header

| #   | What                | Trigger | Change                                                                                                                           | Timing                                                      |
| --- | ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A1  | Render panel        | load    | `clip-path: inset(0 0 0 100%)` → `inset(0 0 0 66.66%)`                                                                           | `--duration-reveal` `--ease-wipe`, 400 ms delay             |
| A2  | Hero video tile     | load    | `clip-path: inset(100% 0 0 0)` + `translateY(5%)` → rest                                                                         | as A1                                                       |
| A3  | Wordmark glyphs     | load    | `translateY(100%)`, opacity 0 → rest, each in its own mask                                                                       | `--duration-reveal` `--ease-out`, `--stagger-glyph`         |
| A4  | Tagline characters  | load    | Rise as A3                                                                                                                       | `--duration-reveal` `--ease-out`, 800 ms + `--stagger-char` |
| A5  | Panel expand + zoom | scrub   | Panel clip left 66.66 % → 0; render `translateX(5.3%) scale(.77)` → none, origin 120 % 100 %                                     | 0 → 1 vh (snapped), `quadOut`                               |
| A6  | Wordmark peel       | scrub   | Glyph `i` (0–8) `translateY(0)` → `−(50 + 75i)%` per vh, clipped per glyph                                                       | linear, unclamped                                           |
| A7  | Hero row drift      | scrub   | `translateX(0)` → `−7.29%` per vh                                                                                                | linear                                                      |
| A8  | Header logo         | scrub   | Opacity 0 → 1 (home only); mobile: the phone fades 1 → 0 over 13 → 18svh                                                         | 18svh → 23svh, linear                                       |
| A9  | Header collapse     | scroll  | Background layer `translateY(-102%)` → 0 with `backdrop-filter: blur(5px)` and a 1 px line; removed under 10 px                  | `--duration-slow` `--ease-out`                              |
| A10 | Header theme        | section | Header and fixed buttons switch theme from the scene underneath; text colour instant, the background layer crossfades by opacity | `--duration-button` `--ease-wipe`                           |
| A43 | Hero snap           | wheel   | Snaps between 0 and 100svh; going down snaps forward after 1/5 vh (180 px)                                                       | Lenis lerp accelerating over 2 s                            |

`backdrop-filter` in A9 is a static style of the collapsed layer, not an
animated property; the layer moves by `transform`.

### Scenes

| #   | What                      | Trigger           | Change                                                                                                                                                                                                        | Range, timing                                                     |
| --- | ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A11 | Blur-by-lines text        | threshold         | `text`                                                                                                                                                                                                        | at 90svh (leads), 80-0 (scene leads); reversible                  |
| A12 | Image in                  | entry             | `image-in`                                                                                                                                                                                                    | on entry                                                          |
| A13 | Grid lines draw           | threshold         | `lines`                                                                                                                                                                                                       | on the scene's threshold; reversible                              |
| A14 | Word spread               | scrub             | `spread`                                                                                                                                                                                                      | ~1 vh, `quadOut`                                                  |
| A15 | Word explode              | scrub             | `explode`                                                                                                                                                                                                     | 1 vh, `quadIn`                                                    |
| A16 | Word staircase            | scrub             | `staircase`                                                                                                                                                                                                   | .75–1 vh, `quadIn`                                                |
| A17 | Pinned title recolour     | sticky            | A pinned word has one copy per scene in that scene's colour, each clipped by its scene, so it recolours exactly at the wipe edge                                                                              | ~4.5 vh                                                           |
| A18 | Doors                     | scrub             | `polygon(0 0,100% 0,100% 100%,50% 100%,50% 0,50% 0,50% 100%,0 100%)` → `polygon(0 0,100% 0,100% 100%,100% 100%,100% 0,0 0,0 100%,0 100%)`: the photo splits at the centre and the halves retract to the edges | `-150-0 → -250-0` (1 vh), `quadIn`, with A15                      |
| A19 | Iris                      | scrub             | `inset(50svh 50% calc(100% - 50svh) 50%)` → `inset(0 0 calc(100% - 100svh) 0)`                                                                                                                                | 1 vh, `quadIn`; the photo inside `translateY(0 → -30%)` over 5 vh |
| A20 | Centre strip              | scrub             | `inset(0 50%)` → `inset(0)`                                                                                                                                                                                   | 1 vh, `quadIn`, then a 50svh hand-off (A25)                       |
| A21 | Window expand             | scrub             | `inset(31.4% 25vw)` → `inset(0)`; image `scale(.85)` → 1 → 1.15; labels fade in at the end, pointer events after 75 %                                                                                         | ~1 vh (+1.75 vh for the image), `quadInOut`                       |
| A22 | Background scroll-through | scrub             | A tall background `translateY(0)` → `−(image height − 100svh)` while a card scrolls over it                                                                                                                   | the section, linear                                               |
| A23 | Crossfade                 | scrub             | The second image's opacity 0 → 1                                                                                                                                                                              | section top at viewport top → bottom at bottom, linear            |
| A24 | Under-scroll              | scrub             | A block `translateY(-50svh)` → 0 entering, 0 → `100svh` leaving                                                                                                                                               | 1 vh each, `quadOut` in / `quadIn` out                            |
| A25 | Pin hand-off              | scrub             | A pinned layer sinks `translateY(0 → 50svh)` under the next one (or eases in from −50svh)                                                                                                                     | 50svh, `quadOut` / `quadIn`; `-150-0 → -250-0` on S1a             |
| A26 | Opposite movers           | scrub             | Left image `−150svh → 0 → 200svh → 250svh`, centre lead `0 → 50svh − 50% → 100svh − 100%`, right image `translateY(100%) → 0`                                                                                 | 2–2.5 vh, linear                                                  |
| A27 | Background parallax       | scrub             | Image at 120 % moves ±10–20 %                                                                                                                                                                                 | while in view, linear                                             |
| A28 | Internal image parallax   | scrub             | An image at 120 % of its frame slides `0 → −overflow`; progress = (top + h) / (vh + h)                                                                                                                        | while in view, linear                                             |
| A29 | Location cards            | threshold         | `clip-up`                                                                                                                                                                                                     | at `-200-0`; leave `--duration-slow`                              |
| A30 | Stat lines                | threshold         | 1 px lines `scaleX(0)` → 1 from the label outward                                                                                                                                                             | `--duration-normal` `--ease-wipe`                                 |
| A31 | Stat swap                 | threshold         | `swap` of numbers and labels between sets (set 1 enters at `-85%`, leaves at `-150%`; set 2 enters at `-150%`)                                                                                                | `--duration-slow`, leave +200 ms, enter +400 ms                   |
| A40 | Alternating text blocks   | threshold + scrub | Each block's lines reveal (`text`) at `100-50`, fade 1 → 0 between `50-0` and `25-0`; the last two slide `translateY(20svh)` → 0                                                                              | `--duration-reveal` / scrub                                       |
| A41 | Decorative drift          | scrub             | Leaf-shadow layers `translateY(±12.5…37.5svh)`                                                                                                                                                                | while in view, linear                                             |
| A42 | Footer rise               | scrub             | Footer inner `translateY(5svh)` → 0                                                                                                                                                                           | 1 vh, linear                                                      |

### Components

| #   | What                         | Trigger    | Change                                                                                                                   | Timing                                                                |
| --- | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| A32 | `BlurSlideshow`              | 5 s timer  | Incoming `blur(--motion-blur-soft)` + opacity 0 → clear; outgoing blurs out                                              | `--duration-block`                                                    |
| A33 | `HoverList`                  | hover      | Left border in text colour, ⊕ → ⊖ by opacity, caption swap with blur in/out                                              | `--duration-normal` `--ease-out`                                      |
| A34 | `TripleCarousel`             | click/drag | One slide per step; 120 % images keep their internal parallax                                                            | 1000 ms `--ease-carousel`; drag release eases out                     |
| A35 | Carousel cursor              | hover      | A 30 px arrow follows the pointer (fine pointers)                                                                        | fade `--duration-normal`                                              |
| A36 | `RollLink`                   | hover      | The label twice, split into characters: row 1 `translateY(0 → -100%)` through a clip, row 2 `100% → 0`                   | `--duration-button` `--ease-wipe`, `--stagger-roll`                   |
| A37 | `RoundButton`                | hover      | Background pseudo-element `scale(1)` → 1.0667 (1.125 on tiny buttons)                                                    | `--duration-normal` `--ease-wipe`                                     |
| A38 | `Burger`                     | hover      | Lines slide right `calc(100% + 7px)` while clones enter from the left (conveyor); line 2 +120 ms; leaving, line 1 +80 ms | `--duration-slow` `--ease-out`                                        |
| —   | `UnderlineLink`              | hover      | `::after` `scaleX(1 → 0)` origin right, `::before` `0 → 1` origin left, +50 ms                                           | `--duration-button`                                                   |
| —   | Text link                    | hover      | Underline `background-size: 0 1px → 100% 1px` as `scaleX` of a pseudo-element                                            | `--duration-slow` `--ease-out`                                        |
| —   | `ArrowBlock`, filled buttons | hover      | Fill fades to its hover colour (ink → ink-hover, cream → cream-hover) on a pseudo-element's opacity                      | `--duration-button`; `--duration-slow` on `ArrowBlock`, `--ease-wipe` |
| —   | Modal close                  | hover      | Icon `rotate(-90deg)`                                                                                                    | `--duration-button` `--ease-wipe`                                     |
| —   | `FlatCard`                   | hover      | Background pseudo-element `scale(1.023, 1.018)`; content still                                                           | `--duration-normal` `--ease-out`                                      |
| —   | Menu cards                   | hover      | The other cards' images turn sepia (grayscale image over the sepia tile, `mix-blend-mode: screen`) by opacity            | `--duration-slow`                                                     |
| —   | `Tabs` content               | click      | Out: opacity with `--ease-exit`; in: crossfade                                                                           | `--duration-normal` `--ease-out`                                      |

### Chrome

| What             | Change                                                                                                                                                                                                                                                                                                 | Timing                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Preloader        | Home, first visit in a session. The curtain rises behind two grid lines: `translateY(calc(100% * (1 - progress)))`, progress = mean of elapsed / 1500 ms and loaded intro assets, lerped .075 per 16 ms; counter `ceil(quadInOut(p) · 100)%`                                                           | min 1.5 s; hides 1 s after complete with an opacity fade, `--duration-normal` `--ease-out`; then A1–A4 |
| Page transition  | Desktop, motion allowed. IN: root `clip-path: inset(100% 0 0 0)` → `inset(0)`, background `translateY(100svh → 0)`, wordmark `translateY(10svh → 0)`; front lines `scaleY(0 → 1)` linear. Hold until the new route has rendered. OUT: `inset(0 0 100% 0)`, background → `-100svh`, wordmark → `-10svh` | `--duration-slow` `--ease-wipe`; lines `--duration-normal` +400 ms                                     |
| Menu             | Panel `clip-path: inset(0 0 100% 0)` → `inset(0)`, backdrop opacity 0 → .5, links `translateY(-20%)` → 0, close button opacity 0 → 1; reverse on close                                                                                                                                                 | `--duration-slow` `--ease-out`                                                                         |
| Inquiry modal    | Panel `clip-path: inset(0 0 0 100%)` → `inset(0 0 0 calc(50% - 90px))`, content `translateX(10%)` → 0, backdrop 0 → .9, close tab opacity; fields instant                                                                                                                                              | `--duration-slow` `--ease-out` (`--duration-normal` full-screen on mobile)                             |
| Next-page teaser | Fades in at 80 % visible; the 120 px "KEÇ" button follows the pointer (fine pointers)                                                                                                                                                                                                                  | `--duration-reveal` `--ease-out`; button fade `--duration-fast`                                        |
| Tab bar          | Active tab follows the scroll; fades out over the footer                                                                                                                                                                                                                                               | `--duration-normal`                                                                                    |
| Fixed buttons    | Fade in after load                                                                                                                                                                                                                                                                                     | `--duration-slow` `--ease-wipe`, 400 ms delay                                                          |

The page transition intercepts same-origin navigations from
`@/i18n/navigation` links only (`useRouter().push` after IN, OUT on the
pathname change). Browser back and forward skip it. It never blocks a
navigation that takes longer than the overlay: it holds.

## Smooth scroll and snap

Lenis, on public routes only, when `(pointer: fine)` matches and reduced
motion is off: `lerp: 0.1`, `wheelMultiplier: 1`, `smoothWheel: true`,
`syncTouch: false`. Touch devices keep native scrolling. Lenis and every
scrubbed effect share one `requestAnimationFrame` loop
(`src/lib/motion/frame.ts`), never two. Same-page anchor clicks glide through
Lenis with the fixed header's offset; a keyboard activation keeps the native
jump, which also moves focus (the skip link relies on it).

The only snap is the home hero (A43), on wheel input within the first
viewport. Keyboard, touch, scrollbar dragging and anchor jumps are never
snapped.

## Per-surface budget

| Surface                       | Allowed                                                                                                                      | Not allowed                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Every public page             | Header (A8–A10), menu, page transition, footer rise (A42) and teaser, tab bar, link and button hovers, `Reveal`, `GridLines` | A second snap; blur outside rule 1                |
| Home `/`                      | Preloader, load intro (A1–A4), hero snap and scene (A5–A7, A43), every scene effect mapped in spec §7.2                      | Animating the inquiry form                        |
| Catalogue `/menziller`        | Curtain background, page-head reveal, `FlatCard` hover, "DAHA ÇOX" button hover                                              | Animating cards on filter change or load; filters |
| Apartment `/menziller/[slug]` | Sticky column, plan `Tabs`, `ArrowBlock` hover, reveals on similar flats                                                     | Anything on the plan, price or form               |
| Inner chapter pages           | Split-title hero with under-next (A24), reveals, parallax (A27, A28), the scene effects spec §7.3 names for the page         | Effects the page's reference does not use         |
| Contact `/elaqe`, privacy     | Split-title hero, reveals on heads                                                                                           | Anything on the forms                             |
| Console `/admin`              | shadcn/ui defaults limited to opacity and transform                                                                          | Motion primitives, Lenis, scroll effects          |

## Reduced motion, touch, no JS

**Reduced motion** (`prefers-reduced-motion: reduce`, checked before any
primitive touches the DOM, and live: turning it on mid-visit finishes running
transitions, stops scrubbing and unpins scenes):

| Element                           | Rendering                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Lenis, hero snap                  | Off                                                                                  |
| Preloader                         | No animation; hidden as soon as the page is ready                                    |
| Page transition                   | Off: plain navigation                                                                |
| Load intro (A1–A4)                | Final state                                                                          |
| Scenes                            | A plain stacked page: pins off, clips open, letters at rest, crossfades at their end |
| `Reveal`, `GridLines`, `Swap`     | Final state; the first stat set and the second as separate rows                      |
| `BlurSlideshow`, `TripleCarousel` | No auto-advance; controls change slides instantly                                    |
| Hovers                            | Instant colour changes; the character roll, conveyor and scales do not run           |
| Video                             | Poster only; no autoplay (also with `Save-Data`)                                     |

**Touch and under 668 px:** native scroll; `Reveal` is off (content is static,
as in the reference); scenes follow the reference's mobile variants
(`pyzhevsky-home.md` §5): no doors (a static photo with its title), stats
stacked vertically, the location cards as rows, carousels and engineering
cards as native horizontal scrollers, the window expand with its mobile
values (`inset(34.8% 15px)`, scale .666 → 1 → 1.501), the hover list as a
one-open accordion. Hover effects are not shown on touch.

**No JavaScript:** the server HTML is the final state of every scene and
component.

The Playwright suite runs with `reducedMotion: "reduce"` and without
JavaScript and asserts all content is in its final state.

## Hidden-until-ready

An entry hides content, so a failure to run it must not hide content forever,
and hiding must never touch what a visitor can already see.

1. Server HTML has no hidden styles, and no CSS hides an entry target (the
   reference's `opacity: .005` start state is not copied)
2. After hydration, each primitive measures its element once. Only an element
   still entirely below the viewport is hidden, with inline styles, and
   registered for its entry; anything in or above the viewport (including
   after a restored scroll position) keeps its final state
3. Hidden elements are below the viewport, so hiding them never shows as a
   flash, and it cannot happen before the script that will reveal them runs
4. An element near the end of the page that can never reach its trigger
   enters when the page is scrolled to its end
5. Scrubbed effects write their start state only when their range has not
   been passed; a scene whose script fails stays in its server (final) state

## Performance

- No animation library. Time-based transitions are CSS transitions or the Web
  Animations API with the easing tokens; scrubbed effects write `transform`,
  `clip-path` and `opacity` from the shared frame loop, from geometry
  measured on resize (`onMeasure`), and write a style only when its value
  changed. No layout reads per frame
- `filter: blur()` only within rule 1's limits; never on a full-bleed layer
- Motion JS under 40 KB gzip on the routes that load it, inside the 160 KB
  per-route budget (`pnpm budget:js`). Measured in #16: the current primitives
  5.5 KB, `SmoothScroll` and the frame loop about 1 KB, Lenis 5.4 KB loaded
  only for fine pointers
- One `IntersectionObserver` for every `Reveal`; elements entering in the
  same frame stagger together
- No permanent `will-change`. A scrubbed layer gets `will-change: transform`
  only while its scene is pinned
- Images and video inside animated frames are sized by aspect-ratio CSS, so
  no animation causes layout shift (CLS < 0.05)
- The home LCP element is the hero poster or the render panel image, never
  the video, and never hidden at first paint (A1 wipes `clip-path` on an
  already painted image)
- Verify with a Performance trace while scrolling the home page at 4× CPU
  throttling: no long tasks from animation, no layout per frame
