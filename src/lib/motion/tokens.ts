/**
 * Motion constants for script, mirroring src/styles/tokens.css so CSS
 * transitions and the primitives read one set of values
 * (docs/motion-system.md). tests/unit/motion.test.ts keeps the two in step.
 */

/** Milliseconds, as the Web Animations API expects. */
export const duration = {
  fast: 200,
  normal: 400,
  button: 600,
  slow: 800,
  block: 1400,
  reveal: 1600,
} as const;

export const ease = {
  /** The house curve: reveals, links, header, modals, cards. */
  out: "cubic-bezier(0.25, 0.74, 0.22, 0.99)",
  /** Wipes, the load intro, the character roll, button fills, line draws. */
  wipe: "cubic-bezier(0.7, 0, 0.4, 1)",
  /** Blur-out, tab content out. */
  exit: "cubic-bezier(0.47, 0.04, 0.5, -0.06)",
  carousel: "cubic-bezier(0.6, 0, 0.1, 1)",
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
} as const;

/** `filter: blur()` start values in pixels: text and image reveals, the slideshow. */
export const blur = { reveal: 20, soft: 10 } as const;

/** Delays in milliseconds (`--delay-*` in tokens.css). */
export const delay = {
  /** Before a reveal on entry starts (the reference's 30 ms). */
  reveal: 30,
} as const;

/**
 * `Reveal` on entry (spec §6.2): the observer's bottom margin in px, the
 * share of a group member that must be visible, and how many members of one
 * batch stagger before the rest enter with the last.
 */
export const reveal = { margin: 100, groupThreshold: 0.5, maxStagger: 6 } as const;

/**
 * `SplitWord` offsets in vw (motion-system.md → Per-letter word animations):
 * `spread` A14, `explode` A15, `staircase` A16.
 */
export const wordMotion = {
  spread: { outer: 20, inner: 10 },
  explode: { outer: 37.5, inner: 7.5, step: 5 },
  staircase: { step: 2 },
} as const;

/**
 * The hero snap (A43): forward after this share of a viewport, over this
 * many milliseconds (the reference's lerp accelerating over 2 s).
 */
export const heroSnap = { threshold: 0.2, duration: 2000 } as const;

/** Lenis settings (docs/motion-system.md → Smooth scroll). */
export const smoothScroll = { lerp: 0.1, wheelMultiplier: 1 } as const;
