# Motion recipes

How the engine in [`docs/motion-system.md`](../../../../docs/motion-system.md)
is built and how to use it. The code is the reference: `src/lib/motion/`
(engine) and `src/components/motion/` (components). Numbers live in
`src/lib/motion/tokens.ts`, which mirrors `src/styles/tokens.css`; never write
a duration, easing, stagger or distance literal in a component.

There is no animation library. GSAP and ScrollTrigger were planned and dropped
in #16: measured at 46 KB gzip together, they broke the 40 KB motion budget on
their own. Time-based transitions are CSS transitions or the Web Animations
API, scroll-linked effects run on one `requestAnimationFrame` loop, pins are
CSS `position: sticky`.

Status marks: **exists** (in `main`), **#63** (the scroll engine and
primitives PR builds it), **#64** / **#66–#68** (built with the chrome or the
page that needs it), **retires** (replaced by #63; removed when the last page
using it is rebuilt).

## Engine

| Module           | Status  | What it does                                                                                                                                                                                               |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`         | exists  | `prefersReducedMotion`, `hasFinePointer`, `onReducedMotion`, `isBelowViewport`. #63 adds `isDesktopMotion` (`pointer: fine` and ≥ 668 px, the reference's switch)                                          |
| `frame.ts`       | exists  | The one frame loop: `onMeasure` (layout may have changed) runs before `onScrollFrame` (scroll may have changed). Drives Lenis when it runs. Scenes, scrubs and thresholds all subscribe here               |
| `tokens.ts`      | exists  | Durations, easings, `scrubEase` (`linear`, `quadOut`, `quadIn`, `quadInOut`), staggers, blur values                                                                                                        |
| `range.ts`       | #63     | `parseRange("-150-0 → -250-0")` and `progress(geometry, range, scrollY)`: the reference's range notation as pure, unit-tested functions                                                                    |
| `scrub.ts`       | #63     | `useScrub(ref, range, ease, apply)`: measures the element's document offset and height in `onMeasure`, computes progress in `onScrollFrame` from cached numbers only, calls `apply(eased)` when it changed |
| `threshold.ts`   | #63     | `useThreshold(ref, point, enter, leave)`: crossing state from cached geometry; sets `data-state="in"` or `"out"` so CSS transitions play the enter or leave variant                                        |
| `reveal.ts`      | #63     | One shared `IntersectionObserver` (`rootMargin: 0px 0px -100px 0px`); groups reveal at threshold .5 with `--stagger-group` and a 30 ms delay; replaces `entry.ts`                                          |
| `split-lines.ts` | exists  | Splits a block into measured lines and restores its nodes; the `text` reveal reuses it (each line gets its own clip)                                                                                       |
| `split-word.ts`  | #63     | Grapheme split with `Intl.Segmenter`; letter offsets for `spread`, `explode` and `staircase` from the letter count                                                                                         |
| `snap.ts`        | #63     | The hero snap (A43): wheel only, first viewport, forward after 1/5 vh, through Lenis `scrollTo` with an accelerating lerp over 2 s                                                                         |
| `bezier.ts`      | exists  | Evaluates an easing token in script (counters, scripted timelines)                                                                                                                                         |
| `entry.ts`       | retires | The 85 %-line entry of the old primitives                                                                                                                                                                  |
| `pinned.ts`      | retires | `pinnedScenes()`, the `PinnedCardZoom` choreography                                                                                                                                                        |

## Primitives

| Component                                                                           | Status  | Use                                                                                       |
| ----------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `Scene`, `SceneLayer`                                                               | #63     | Every chapter page and the home page; `underPrevious`, `underNext`, `data-theme`          |
| `Reveal`                                                                            | #63     | `variant`: `text`, `image-in`, `clip-down`, `clip-up`; `group`                            |
| `SplitWord`                                                                         | #63     | Giant words and split titles; `animation`: `spread`, `explode`, `staircase`, with a range |
| `GridLines`                                                                         | #63     | `variant`: `center`, `thirds`, `quarters`, `wider`; `alt`, `mobileAll`; draws in          |
| `Swap`                                                                              | #63     | Stat numbers and labels (A31)                                                             |
| `RollLink`, `UnderlineLink`, `ArrowBlock`, `RoundButton`, `Burger`                  | #64     | Links and buttons with their hovers (A36–A38)                                             |
| Preloader, page transition, header, menu, footer and teaser, tab bar, inquiry modal | #64     | Chrome (motion-system → Chrome)                                                           |
| `HoverList`, `StatSpread`, `TripleCarousel`, `BlurSlideshow`, `LocationCard`        | #66     | Home scenes                                                                               |
| `FlatCard`, `Segmented`, `RangeHairline`, plan `Tabs`                               | #67     | Catalogue and apartment page                                                              |
| `FadeUp`, `LineReveal`, `ImageReveal`, `Parallax`, `PinnedCardZoom`, `CountUp`      | retires | The current pages, until #66–#68 rebuild them                                             |

```tsx
// Sketch of the #63 API; the code is the reference once it lands.
<Scene theme="dark" underNext>
  <SceneLayer>{background}</SceneLayer>
  <SplitWord as="h2" animation="explode" range="-150-0 → -250-0">
    {t("words.territory")}
  </SplitWord>
</Scene>

<Reveal variant="text" as="p" className="text-lead">{t("lead")}</Reveal>
<Reveal group variant="clip-down" as="ul">{columns}</Reveal>
<GridLines variant="thirds" />
```

## Building an effect

- Find it in the catalogue first (motion-system.md) and copy its range,
  easing and values. If it is not there, it is a design change to that
  document
- Scrubbed: `useScrub` with the catalogue's range and `scrubEase`; `apply`
  writes `transform`, `clip-path` or `opacity` on refs, never React state.
  Use the individual `translate` and `scale` properties when the element has
  its own transform classes
- Threshold: `useThreshold` plus CSS transitions on `[data-state]` with the
  duration and easing tokens; the leave variant is the reverse unless the
  catalogue gives one (`clip-down` leaves in `--duration-slow`)
- Per letter: `SplitWord` computes offsets from the letter count, so the
  effect works for every locale's word; never hard-code per-letter values
- Blur: only `text`, `image-in`, `BlurSlideshow` and the `HoverList` caption,
  never on a full-bleed layer
- In a frame callback read only cached geometry (measure in `onMeasure`) and
  write a style only when its value changed
- Every effect renders its final state on the server, hides nothing before
  hydration (only elements entirely below the viewport may get a start
  state), and cleans up to the final state on unmount and when reduced motion
  turns on mid-visit
- Under 668 px or on touch, use the reference's mobile variant
  (`pyzhevsky-home.md` §5) or no motion

## Hero

Rebuilt with the home page (#66) on the engine; the current hero (poster
settle, video crossfade) retires.

- The hero poster (or the render panel image) is in the server HTML with
  `fetchPriority="high"` and visible at first paint: it is the LCP element.
  The preloader sits above it and never delays its request
- After the preloader hides: A1–A4 (panel and tile wipe their `clip-path`,
  wordmark glyphs and tagline characters rise)
- The snap (A43) and the scrubbed scene (A5–A7) take the first 100svh
- The video tile loads after `load` when reduced motion is off and
  `navigator.connection?.saveData` is not true

## Verifying

- The development playground `/primitivler/hereket` shows every primitive
  (production answers 404 unless `ENABLE_PRIMITIVES=1`); #63 replaces its
  content with the new primitives
- `tests/e2e/motion.spec.ts`: final state with reduced motion and without
  JavaScript, below-fold hiding and the end state with motion on
- Unit tests for `range.ts`, `scrubEase`, the `SplitWord` offsets and the
  scene clip maths
- Performance trace at 4× CPU throttle while scrolling: no long tasks from
  animation, no "Layout" bars per frame
- Toggle reduced motion in DevTools (Rendering → Emulate CSS media feature)
  and reload: everything visible, nothing pinned
