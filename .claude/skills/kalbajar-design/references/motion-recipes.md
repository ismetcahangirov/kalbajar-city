# Motion recipes

Implementation sketches for the primitives in
[`docs/motion-system.md`](../../../../docs/motion-system.md). The numbers live
in that document and in `src/lib/motion/tokens.ts`; these recipes reference the
constants, never literals. Sketches show the shape of the code, not a finished
file: check the installed GSAP and Lenis versions' docs before copying an API.

```ts
// src/lib/motion/tokens.ts (#16): mirrors tokens.css
export const duration = {
  fast: 0.2,
  base: 0.4,
  crossfade: 0.6,
  reveal: 0.9,
  wipe: 1.2,
  count: 1.6,
  settle: 2.4,
} as const; // seconds, as GSAP expects
export const ease = {
  out: "expo.out",
  inOut: "power3.inOut",
  standard: "power2.out",
} as const;
export const rise = 24;
export const stagger = { block: 0.08, image: 0.12, max: 6 } as const;
export const triggerStart = "top 85%";
```

## Provider

One client `MotionProvider` per public layout. It dynamically imports GSAP,
ScrollTrigger and Lenis, so the server bundle and the console never include
them.

```ts
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => {
  const smooth = window.matchMedia("(pointer: fine)").matches;
  const lenis = smooth ? new Lenis({ lerp: 0.1, smoothWheel: true, autoRaf: false }) : null;
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
  }
  markMotionReady(); // cancels the 3 s fallback that removes html.js-motion
  return () => {
    lenis?.destroy(); // and remove the ticker callback
  };
});
```

The fixed header offset is passed to `lenis.scrollTo(target, { offset })`
for anchor links.

## FadeUp

```ts
ScrollTrigger.batch("[data-fade-up]", {
  start: triggerStart,
  once: true,
  onEnter: (els) =>
    gsap.fromTo(
      els,
      { autoAlpha: 0, y: rise },
      {
        autoAlpha: 1,
        y: 0,
        duration: duration.reveal,
        ease: ease.out,
        stagger: { each: stagger.block, amount: stagger.block * (stagger.max - 1) },
        clearProps: "transform,willChange",
      },
    ),
});
```

CSS hides `[data-fade-up]` only under `html.js-motion` and
`(prefers-reduced-motion: no-preference)`. Elements in the first viewport are
skipped by the component (it checks its rect on mount) and never hidden.

## LineReveal

- Wait for `document.fonts.ready`, then split the heading into lines by
  measuring each word's `offsetTop`. Wrap each line in
  `<span class="line"><span class="line-inner">…</span></span>`, the outer
  `overflow: clip` with a little bottom padding so descenders (ğ, ç, ş, у)
  are not cut
- Keep the accessible name intact: `aria-label` on the heading with the
  original text, the split spans `aria-hidden="true"`
- Animate `.line-inner` from `yPercent: 105` to `0`, `duration.reveal`,
  `ease.out`, `stagger.block`
- Re-split on width change (debounced `ResizeObserver`) only if the animation
  has not run yet; after it ran, restore the plain text

## ImageReveal

```ts
gsap
  .timeline({ scrollTrigger: { trigger: frame, start: triggerStart, once: true } })
  .fromTo(
    frame,
    { clipPath: "inset(100% 0% 0% 0%)" },
    {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: duration.wipe,
      ease: ease.inOut,
    },
  )
  .fromTo(img, { scale: 1.12 }, { scale: 1, duration: duration.wipe, ease: ease.out }, 0);
```

Use percentages in both `inset()` values so GSAP interpolates them. In a grid,
offset each frame's start by `stagger.image × index` (cap at `stagger.max`).
The frame keeps its aspect ratio from CSS before the image loads.

## Parallax

```ts
gsap.fromTo(
  media,
  { yPercent: -8 },
  {
    yPercent: 8,
    ease: "none",
    scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true },
  },
);
```

The media is `scale(1.16)` in CSS so its edges never show. Hero variant:
`start: "top top"`, `end: "bottom top"`, `yPercent: 0 → 50` on the media, so it
moves at about half the scroll speed while the next section rises over it.
Disabled on touch (native scroll makes scrubbed parallax jitter) and with
reduced motion.

## PinnedCardZoom

Structure, server-rendered as a list of scenes (which is also the
reduced-motion and no-JS rendering):

```
section[data-pinned-scenes]
  ol > li.scene × N      (full-bleed image, caption, chips)
```

With motion on, the provider turns it into a stack: scenes absolutely
positioned on top of each other, scene `i + 1` clipped to the card rectangle
and wrapped in an `ImageFrame`.

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: section,
    pin: true,
    scrub: 0.6,
    start: "top top",
    end: () => `+=${(scenes.length - 1) * window.innerHeight}`,
    invalidateOnRefresh: true,
  },
});
scenes.slice(1).forEach((scene, i) => {
  const card = cardInset(); // inset() percentages of the centred card, recomputed on refresh
  tl.fromTo(
    scene.layer,
    { clipPath: `inset(${card} round 8px)` },
    {
      clipPath: "inset(0% 0% 0% 0% round 16px)",
      ease: "none",
      duration: 1,
    },
    i,
  )
    .to(scene.frame, { autoAlpha: 0, ease: "none", duration: 0.3 }, i)
    .to(scenes[i].caption, { autoAlpha: 0, duration: 0.1 }, i + 0.45)
    .fromTo(scene.caption, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, i + 0.5);
});
```

Card size: 28 vw wide, minimum 240 px, 4 : 5 ratio below `md`, 16 : 10 above.
Each scene's image is `object-position` from its media-library focus point.
Three or four scenes; more makes the pin feel like a trap.

## CountUp

```tsx
<span className="grid">
  <span className="invisible [grid-area:1/1]">{formatted(final)}</span>
  <span aria-hidden className="[grid-area:1/1]" ref={live} />
  <span className="sr-only">{formatted(final)}</span>
</span>
```

```ts
const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: decimals });
const state = { v: 0 };
gsap.to(state, {
  v: final,
  duration: duration.count,
  ease: ease.out,
  scrollTrigger: { trigger: el, start: triggerStart, once: true },
  onUpdate: () => {
    live.textContent = fmt.format(state.v);
  },
});
```

Locale formatting matters (Node 24 ICU, checked 2026-11-01): `22.634` (az),
`22,634` (en), `22 634` (ru, with a no-break space U+00A0). Units (`m²`) sit
outside the counting span.

## Hero

- Poster `<img>` with `fetchPriority="high"` is the LCP element and is visible
  at first paint. CSS settles it from `scale(1.06)` to `scale(1)` over
  `--duration-settle` with `--ease-out`; this starts visible, so it does not
  delay LCP
- After `load`, if reduced motion is off and `navigator.connection?.saveData`
  is not true, create the `<video muted playsinline loop>`; on `canplaythrough`
  fade it in over the poster (`--duration-crossfade`)
- The headline renders in its final state. No `LineReveal` on the hero

## Verifying a primitive

- The dev-only playground page (#16) shows each primitive alone
- Performance trace at 4× CPU throttle while scrolling: no long tasks from
  animation, no "Layout" or "Paint" bars per frame
- Toggle reduced motion in DevTools (Rendering → Emulate CSS media feature) and
  reload: everything visible, nothing pinned
- Disable JavaScript and reload: everything visible
