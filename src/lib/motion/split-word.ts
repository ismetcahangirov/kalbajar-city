import { wordMotion } from "./tokens";

/**
 * The giant word's letters and the per-letter offsets of its scrubbed
 * animations (docs/motion-system.md → Per-letter word animations). Offsets
 * come from the letter count and index only, so every locale's word works.
 */

/**
 * User-perceived characters: `Ə`, `İ` and letters with combining marks stay
 * whole. `Intl.Segmenter` exists in every supported browser and in Node.
 */
export function graphemes(text: string, locale?: string): string[] {
  if (typeof Intl.Segmenter !== "function") return Array.from(text);
  const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** Distance of letter `i` from the word's centre, in letters (negative: left). */
const fromCentre = (i: number, n: number) => i - (n - 1) / 2;

/**
 * `spread` (A14), in vw: where each letter starts, bunched toward the centre;
 * it ends at 0. The outer letters start ±20vw in, the inner ones ±10vw,
 * linear in between; a centre letter (odd counts) stays. "ОКНА" is
 * +20, +10, −10, −20.
 */
export function spreadOffsets(n: number): number[] {
  const { outer, inner } = wordMotion.spread;
  const farthest = (n - 1) / 2;
  const nearest = n % 2 === 0 ? 0.5 : 1;
  return Array.from({ length: n }, (_, i) => {
    const d = fromCentre(i, n);
    if (d === 0) return 0;
    const share = farthest > nearest ? (Math.abs(d) - nearest) / (farthest - nearest) : 1;
    return -Math.sign(d) * (inner + (outer - inner) * share);
  });
}

/**
 * `explode` (A15), in vw: where each letter ends, flown outward; it starts
 * at 0. The outermost letters travel ±37.5vw and each one further in 5vw
 * less, down to ±7.5vw; left of the centre negative, right positive, a centre
 * letter stays.
 */
export function explodeOffsets(n: number): number[] {
  const { outer, inner, step } = wordMotion.explode;
  return Array.from({ length: n }, (_, i) => {
    const d = fromCentre(i, n);
    if (d === 0) return 0;
    const fromEdge = d < 0 ? i : n - 1 - i;
    return Math.sign(d) * Math.max(inner, outer - step * fromEdge);
  });
}

/**
 * `staircase` (A16), in vw: how far below its rest each letter starts,
 * `(i + 1) · 2vw`; it rises to 0 out of the word's clip.
 */
export function staircaseOffsets(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i + 1) * wordMotion.staircase.step);
}
