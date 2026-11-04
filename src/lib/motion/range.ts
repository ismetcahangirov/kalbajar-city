/**
 * The reference's scroll-range notation as pure functions
 * (docs/motion-system.md → Ranges), so every scrubbed effect and threshold
 * reads one meaning of "100-0" and the maths is unit-tested without a browser.
 *
 * A point `"A-B"` is the moment the point B % down the element (0 its top,
 * 100 its bottom) sits A % down the viewport: `100-0` is the element's top at
 * the viewport's bottom, `0-0` its top at the top, `0-100` its bottom at the
 * top, `-100-0` its top one viewport above the top. A bare viewport length,
 * `"90svh"` or `"-150%"`, is the moment the element's top crosses it, so
 * `"-150%"` is `"-150-0"`. A range is two points: `"100-0 → 0-0"`.
 */

/** Both as fractions: 1 is the whole viewport, the whole element. */
export type Point = { viewport: number; element: number };

export type Range = readonly [Point, Point];

/** What a primitive measures on resize and caches between frames. */
export type Geometry = {
  /** The element's top relative to the document, in px. */
  top: number;
  /** Its layout height, in px. */
  height: number;
  /** The viewport's height, in px. */
  viewport: number;
};

const number = String.raw`-?\d+(?:\.\d+)?`;
const pairPattern = new RegExp(`^(${number})-(${number})$`);
const lengthPattern = new RegExp(`^(${number})(?:svh|vh|%)$`);

export function parsePoint(input: string): Point {
  const text = input.trim();
  const pair = pairPattern.exec(text);
  if (pair) return { viewport: Number(pair[1]) / 100, element: Number(pair[2]) / 100 };
  const length = lengthPattern.exec(text);
  if (length) return { viewport: Number(length[1]) / 100, element: 0 };
  throw new Error(`Not a scroll point: "${input}"`);
}

export type RangeInput = string | readonly [string, string];

/** `"100-0 → 0-0"` (or `->`), or the two points as a pair. */
export function parseRange(input: RangeInput): Range {
  const parts = typeof input === "string" ? input.split(/\s*(?:→|->)\s*/) : input;
  if (parts.length !== 2) throw new Error(`Not a scroll range: "${String(input)}"`);
  return [parsePoint(parts[0]!), parsePoint(parts[1]!)];
}

/** The scroll position at which the point is reached. */
export function scrollAt(point: Point, geometry: Geometry): number {
  return geometry.top + point.element * geometry.height - point.viewport * geometry.viewport;
}

/**
 * Progress through the range at `scrollY`: 0 at its first point, 1 at its
 * second, clamped to 0…1 unless `clamped` is false (the wordmark peel). An
 * empty range is a step at its point.
 */
export function rangeProgress(
  range: Range,
  geometry: Geometry,
  scrollY: number,
  clamped = true,
): number {
  const start = scrollAt(range[0], geometry);
  const end = scrollAt(range[1], geometry);
  if (end === start) return scrollY >= start ? 1 : 0;
  const t = (scrollY - start) / (end - start);
  return clamped ? Math.min(1, Math.max(0, t)) : t;
}

/**
 * How many of the points `scrollY` has reached. Points are expected in scroll
 * order; a threshold is one point (0 before it, 1 after), a swap of sets is
 * several.
 */
export function pointsPassed(points: readonly Point[], geometry: Geometry, scrollY: number) {
  let passed = 0;
  for (const point of points) if (scrollY >= scrollAt(point, geometry)) passed++;
  return passed;
}
