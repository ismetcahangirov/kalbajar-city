import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cubicBezier } from "@/lib/motion/bezier";
import { pinnedScenes, type Inset } from "@/lib/motion/pinned";
import { blur, duration, ease, parallax, rise, scrubEase, stagger } from "@/lib/motion/tokens";

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
    expect(token("ease-in-out")).toBe(ease.inOut);
    expect(token("ease-standard")).toBe(ease.standard);
    for (const name of ["line", "glyph", "char", "roll", "group"] as const) {
      expect(token(`stagger-${name}`), name).toBe(`${stagger[name]}ms`);
    }
    expect(token("motion-blur")).toBe(`${blur.reveal}px`);
    expect(token("motion-blur-soft")).toBe(`${blur.soft}px`);
    expect(token("motion-rise")).toBe(`${rise}px`);
    expect(token("motion-stagger")).toBe(`${stagger.block}ms`);
    expect(token("motion-stagger-image")).toBe(`${stagger.image}ms`);
    expect(token("motion-parallax-scale")).toBe(String(parallax.scale));
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

describe("pinnedScenes", () => {
  const card: Inset = { top: 30, right: 36, bottom: 30, left: 36 };
  const count = 4;

  it("starts on the first scene with the second as a framed card", () => {
    const [first, second, third] = pinnedScenes(0, count, card);
    expect(first?.captionOpacity).toBe(1);
    expect(second?.clip).toEqual(card);
    expect(second?.layerOpacity).toBe(1);
    expect(second?.frameOpacity).toBe(1);
    expect(second?.captionOpacity).toBe(0);
    expect(third?.layerOpacity).toBe(0);
  });

  it("ends with the last scene filling the stage and only its caption shown", () => {
    const states = pinnedScenes(1, count, card);
    const last = states.at(-1);
    expect(last?.clip).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(last?.frameOpacity).toBe(0);
    expect(states.map((s) => s.captionOpacity)).toEqual([0, 0, 0, 1]);
  });

  it("has a caption showing at every point but the cross-fade", () => {
    for (let p = 0; p <= 1; p += 0.01) {
      const shown = pinnedScenes(p, count, card).filter((s) => s.captionOpacity > 0.99);
      expect(shown.length).toBeLessThanOrEqual(1);
    }
  });

  it("brings the next card in only once the previous scene is full", () => {
    // Middle of the first transition: scene 1 is growing, scene 2 not shown.
    const middle = pinnedScenes(1 / 6, count, card);
    expect(middle[1]?.clip.top).toBeGreaterThan(0);
    expect(middle[1]?.clip.top).toBeLessThan(card.top);
    expect(middle[2]?.layerOpacity).toBe(0);
    // Start of the second transition: scene 2's card has faded in.
    const next = pinnedScenes(1 / 3 + 0.15 / 3, count, card);
    expect(next[1]?.clip.top).toBe(0);
    expect(next[2]?.layerOpacity).toBeCloseTo(1, 5);
    expect(next[2]?.clip).toEqual(card);
  });

  it("clamps progress outside the pin", () => {
    expect(pinnedScenes(-1, count, card)).toEqual(pinnedScenes(0, count, card));
    expect(pinnedScenes(2, count, card)).toEqual(pinnedScenes(1, count, card));
  });
});
