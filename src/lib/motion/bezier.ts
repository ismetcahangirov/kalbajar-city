/**
 * Evaluates a CSS cubic Bézier easing token in script, for the one primitive
 * that animates a value rather than a style (`CountUp`), so it eases with the
 * same token as everything else.
 */
export function cubicBezier(css: string): (t: number) => number {
  const match = css.match(/\(([^)]+)\)/);
  const points = match?.[1]?.split(",").map(Number) ?? [];
  if (points.length !== 4 || points.some(Number.isNaN)) {
    throw new Error(`Not a cubic-bezier easing: ${css}`);
  }
  const [x1, y1, x2, y2] = points as [number, number, number, number];

  // Bézier polynomial coefficients for one axis.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  // The curve parameter whose x is `x`: Newton's method, then bisection when
  // the slope is too flat to trust.
  const solve = (x: number) => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(s) - x;
      if (Math.abs(error) < 1e-6) return s;
      const slope = slopeX(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= error / slope;
    }
    let low = 0;
    let high = 1;
    s = x;
    while (high - low > 1e-6) {
      if (sampleX(s) < x) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return s;
  };

  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : sampleY(solve(t)));
}
