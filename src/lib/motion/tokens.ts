/**
 * Motion constants for script, mirroring src/styles/tokens.css so CSS
 * transitions and the primitives read one set of values
 * (docs/motion-system.md). tests/unit/motion.test.ts keeps the two in step.
 *
 * Entries marked "legacy" are used by the current primitives until #63
 * replaces them with the scene engine.
 */

/** Milliseconds, as the Web Animations API expects. */
export const duration = {
  fast: 200,
  normal: 400,
  button: 600,
  slow: 800,
  block: 1400,
  reveal: 1600,
  // Legacy.
  base: 400,
  crossfade: 600,
  entry: 900,
  wipe: 1200,
  count: 1600,
  settle: 2400,
} as const;

export const ease = {
  /** The house curve: reveals, links, header, modals, cards. */
  out: "cubic-bezier(0.25, 0.74, 0.22, 0.99)",
  /** Wipes, the load intro, the character roll, button fills, line draws. */
  wipe: "cubic-bezier(0.7, 0, 0.4, 1)",
  /** Blur-out, tab content out. */
  exit: "cubic-bezier(0.47, 0.04, 0.5, -0.06)",
  carousel: "cubic-bezier(0.6, 0, 0.1, 1)",
  // Legacy.
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** Easings for scroll-scrubbed progress (0…1 in, 0…1 out). */
export const scrubEase = {
  linear: (t: number) => t,
  /** The reference's `easeSection`: fast start, settles at the end. */
  quadOut: (t: number) => 2 * t - t * t,
  /** The reference's `easeSectionInverse`: slow start. */
  quadIn: (t: number) => t * t,
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
} as const;

export type ScrubEase = keyof typeof scrubEase;

/** Delay between siblings, in milliseconds. */
export const stagger = {
  /** Lines of a `text` reveal. */
  line: 40,
  /** Glyphs of the hero wordmark. */
  glyph: 50,
  /** Characters of a tagline. */
  char: 10,
  /** Characters of a `RollLink` hover. */
  roll: 16,
  /** Members of a reveal group. */
  group: 180,
  // Legacy.
  block: 80,
  image: 120,
  max: 6,
} as const;

/** `filter: blur()` start values in pixels: text and image reveals, the slideshow. */
export const blur = { reveal: 20, soft: 10 } as const;

/** Legacy: an entry starts when the element's top crosses this share of the viewport. */
export const triggerLine = 0.85;

/** Legacy `LineReveal`: each line rises from this share of its own height. */
export const lineRise = 1.05;

/** Legacy `ImageReveal`: the image settles from this scale while the frame wipes. */
export const revealScale = 1.12;

/** Legacy `FadeUp` start offset, in pixels. */
export const rise = 24;

/** Legacy `Parallax`: travel in percent of the media's height, and the pre-scale that hides its edges. */
export const parallax = { travel: 8, scale: 1.16, heroTravel: 50 } as const;

/** Legacy `PinnedCardZoom`: card and stage corner radius in pixels, 0 since the public site is square. */
export const pinnedRadius = { card: 0, stage: 0 } as const;

/** Lenis settings (docs/motion-system.md → Smooth scroll). */
export const smoothScroll = { lerp: 0.1, wheelMultiplier: 1 } as const;
