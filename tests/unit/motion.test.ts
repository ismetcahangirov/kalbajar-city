import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cubicBezier } from "@/lib/motion/bezier";
import { blur, delay, duration, ease, scrubEase, stagger } from "@/lib/motion/tokens";

const css = readFileSync(
  fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
  "utf8",
);

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`token not found: --${name}`);
  return match[1].trim();
}

describe("motion tokens", () => {
  it("mirror tokens.css", () => {
    for (const [name, ms] of Object.entries(duration)) {
      expect(token(`duration-${name}`), name).toBe(`${ms}ms`);
    }
    expect(token("ease-out")).toBe(ease.out);
    expect(token("ease-wipe")).toBe(ease.wipe);
    expect(token("ease-exit")).toBe(ease.exit);
    expect(token("ease-carousel")).toBe(ease.carousel);
    for (const name of ["line", "glyph", "char", "roll", "group"] as const) {
      expect(token(`stagger-${name}`), name).toBe(`${stagger[name]}ms`);
    }
    expect(token("delay-reveal")).toBe(`${delay.reveal}ms`);
    expect(token("motion-blur")).toBe(`${blur.reveal}px`);
    expect(token("motion-blur-soft")).toBe(`${blur.soft}px`);
  });

  it("match the values measured on the reference (spec §6.1)", () => {
    expect(duration).toMatchObject({
      fast: 200,
      normal: 400,
      button: 600,
      slow: 800,
      block: 1400,
      reveal: 1600,
    });
    expect(stagger).toMatchObject({ line: 40, glyph: 50, char: 10, roll: 16, group: 180 });
  });
});

describe("scrubEase", () => {
  it("is pinned at both ends", () => {
    for (const [name, f] of Object.entries(scrubEase)) {
      expect(f(0), name).toBe(0);
      expect(f(1), name).toBe(1);
    }
  });

  it("matches the reference's curves", () => {
    // easeSection (2t − t²): the reference's render panel, clipped from
    // 66.66 % to 0, was measured at 46.2 % and 29.6 % after 1/6 and 1/3 vh.
    expect(66.66 * (1 - scrubEase.quadOut(1 / 6))).toBeCloseTo(46.2, 0);
    expect(66.66 * (1 - scrubEase.quadOut(1 / 3))).toBeCloseTo(29.6, 0);
    expect(scrubEase.quadIn(0.5)).toBe(0.25);
    expect(scrubEase.quadInOut(0.25)).toBe(0.125);
    expect(scrubEase.quadInOut(0.5)).toBe(0.5);
    expect(scrubEase.quadInOut(0.75)).toBe(0.875);
  });
});

describe("cubicBezier", () => {
  it("is pinned at both ends and monotonic for the entry easing", () => {
    const f = cubicBezier(ease.out);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    let previous = 0;
    for (let t = 0.05; t < 1; t += 0.05) {
      expect(f(t)).toBeGreaterThanOrEqual(previous);
      previous = f(t);
    }
  });

  it("matches known values", () => {
    // A linear curve is the identity; the house curve is far along early,
    // the wipe is slow at both ends.
    const linear = cubicBezier("cubic-bezier(0, 0, 1, 1)");
    expect(linear(0.37)).toBeCloseTo(0.37, 5);
    expect(cubicBezier(ease.out)(0.25)).toBeCloseTo(0.696, 2);
    expect(cubicBezier(ease.wipe)(0.1)).toBeLessThan(0.02);
    expect(cubicBezier(ease.wipe)(0.5)).toBeCloseTo(0.397, 2);
  });

  it("rejects anything else", () => {
    expect(() => cubicBezier("ease-out")).toThrow();
  });
});
