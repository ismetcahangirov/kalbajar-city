# Motion recipes

How the primitives in [`docs/motion-system.md`](../../../../docs/motion-system.md)
are built and how to use them. The code is the reference: `src/lib/motion/`
(engine) and `src/components/motion/` (components). Numbers live in
`src/lib/motion/tokens.ts`, which mirrors `src/styles/tokens.css`; never write
a duration, easing or distance literal in a component.

There is no animation library. GSAP and ScrollTrigger were planned and dropped
in #16: measured at 46 KB gzip together, they broke the 40 KB motion budget on
their own. Entries run on the Web Animations API, scroll-linked effects on one
`requestAnimationFrame` loop, the pin on CSS `position: sticky`.

## Engine

| Module           | What it does                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env.ts`         | `prefersReducedMotion`, `hasFinePointer`, `onReducedMotion`, and `isBelowViewport`, the check that decides whether an element may be hidden at all                                      |
| `frame.ts`       | The one frame loop: `onMeasure` (layout may have changed: resize, body resize) runs before `onScrollFrame` (scroll may have changed). Drives Lenis when it runs                         |
| `entry.ts`       | `registerEntry(element, { kind, play, reveal })`: one shared `IntersectionObserver` at the 85 % line; same-frame entries stagger in document order, capped at six; bottom-of-page flush |
| `split-lines.ts` | Splits a heading into measured lines and restores its original nodes                                                                                                                    |
| `pinned.ts`      | `pinnedScenes(progress, count, card)`: the whole `PinnedCardZoom` choreography as a pure, unit-tested function                                                                          |
| `bezier.ts`      | Evaluates an easing token in script, for `CountUp`                                                                                                                                      |

## Using the primitives

```tsx
import { CountUp, FadeUp, ImageReveal, LineReveal, Parallax, PinnedCardZoom } from "@/components/motion";

<FadeUp className="flex flex-col gap-4">…</FadeUp>            // one block
<FadeUp as="ul" group className="grid …">{items}</FadeUp>     // children stagger

<LineReveal as="h2" size="display">Dağların qoynunda <em>yeni ev</em></LineReveal>

<ImageReveal className="aspect-(--aspect-grid) rounded-md">
  <Image … fill />                                              // first child scales
</ImageReveal>

<Parallax variant="hero" className="absolute inset-0">{poster}</Parallax>
<Parallax className="h-[70svh]">{image}</Parallax>             // size the frame

<Stat value={312} locale={locale} label={t("apartments")}
      numeral={<CountUp value={312} locale={locale} />} />

<PinnedCardZoom aria-label={t("scenes")} scenes={[{ key, media, caption }, …]} />
```

- Every primitive renders its final state on the server. After hydration it
  hides its element only if `isBelowViewport`, then waits for its entry. So
  reduced motion, no JavaScript, a restored scroll position and the first
  viewport all show final content without any CSS gate
- `LineReveal` moves its children out of the heading while waiting. Give it
  static text and inline elements, never interactive children
- `ImageReveal` scales its first element child; the frame needs an aspect
  ratio from CSS so nothing shifts while the image loads
- `Parallax` runs only with a fine pointer. Its inline variant is pre-scaled
  in CSS (`--motion-parallax-scale`) so the edges never show
- `PinnedCardZoom` goes full bleed: place it outside `Container`. With motion
  it gets `data-pinned`, a track `--scene-count × 100svh` tall and a sticky
  stage; captions turn into `night` panels above the mobile action bar. Three
  or four scenes
- `Stat` takes `CountUp` through `numeral`, so a page without counting stats
  never loads the counter

## Adding behaviour

- A new entry is a design change to `docs/motion-system.md` first (rule 2)
- Animate only `opacity`, `translate`, `scale` and `clip-path`. Use the
  individual `translate`/`scale` properties rather than `transform`, so an
  element's own transform classes are left alone
- In a scroll listener read only cached geometry (measure in `onMeasure`) and
  write a style only when its value changed
- Every primitive must clean up to the final state when it unmounts and when
  reduced motion is turned on mid-visit

## Hero

Not a primitive; built with the home page (#17).

- Poster `<img>` with `fetchPriority="high"` is the LCP element and is visible
  at first paint. CSS settles it from `scale(1.06)` to `scale(1)` over
  `--duration-settle` with `--ease-out`; this starts visible, so it does not
  delay LCP
- After `load`, if reduced motion is off and `navigator.connection?.saveData`
  is not true, create the `<video muted playsinline loop>`; on `canplaythrough`
  fade it in over the poster (`--duration-crossfade`)
- The headline renders in its final state. No `LineReveal` on the hero
- The hero wrapper carries `data-header-overlay`; `Parallax variant="hero"`
  holds the poster and video

## Verifying

- The development playground `/primitivler/hereket` shows every primitive
  (production answers 404 unless `ENABLE_PRIMITIVES=1`)
- `tests/e2e/motion.spec.ts`: final state with reduced motion and without
  JavaScript, below-fold hiding and the end state with motion on
- Performance trace at 4× CPU throttle while scrolling: no long tasks from
  animation, no "Layout" bars per frame
- Toggle reduced motion in DevTools (Rendering → Emulate CSS media feature)
  and reload: everything visible, nothing pinned
