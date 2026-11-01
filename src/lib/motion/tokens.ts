/**
 * Motion constants for script, mirroring src/styles/tokens.css so CSS
 * transitions and the primitives read one set of values
 * (docs/motion-system.md). tests/unit/motion-tokens.test.ts keeps the two in
 * step.
 */

/** Milliseconds, as the Web Animations API expects. */
export const duration = {
  fast: 200,
  base: 400,
  crossfade: 600,
  reveal: 900,
  wipe: 1200,
  count: 1600,
  settle: 2400,
} as const;

export const ease = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** `FadeUp` start offset, in pixels. */
export const rise = 24;

/** Delay between siblings entering together, in milliseconds. */
export const stagger = { block: 80, image: 120, max: 6 } as const;

/** An entry starts when the element's top crosses this share of the viewport. */
export const triggerLine = 0.85;

/** `LineReveal`: each line rises from this share of its own height. */
export const lineRise = 1.05;

/** `ImageReveal`: the image settles from this scale while the frame wipes. */
export const revealScale = 1.12;

/** `Parallax`: travel in percent of the media's height, and the pre-scale that hides its edges. */
export const parallax = { travel: 8, scale: 1.16, heroTravel: 50 } as const;

/** `PinnedCardZoom`: card corner radius growing to the stage's, in pixels. */
export const pinnedRadius = { card: 8, stage: 16 } as const;

/** Lenis settings (docs/motion-system.md → Smooth scroll). */
export const smoothScroll = { lerp: 0.1, wheelMultiplier: 1 } as const;
