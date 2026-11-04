import { describe, expect, it } from "vitest";

import { clamp, clamp01, interpolate, mix } from "@/lib/motion/interpolate";
import {
  parsePoint,
  parseRange,
  pointsPassed,
  rangeProgress,
  scrollAt,
  type Geometry,
} from "@/lib/motion/range";
import { heroSnapSettle, heroSnapTarget } from "@/lib/motion/snap";
import {
  explodeOffsets,
  graphemes,
  spreadOffsets,
  staircaseOffsets,
} from "@/lib/motion/split-word";
import { scrubEase } from "@/lib/motion/tokens";

// The scroll-scene engine's pure parts (#63): the reference's range
// notation, value interpolation with the catalogue's clips, the SplitWord
// offsets and the hero snap's decisions.

/** 1440 × 900, an element 2700 px down and 1800 px tall. */
const geometry: Geometry = { top: 2700, height: 1800, viewport: 900 };

describe("parsePoint", () => {
  it("reads the reference's A-B notation", () => {
    expect(parsePoint("100-0")).toEqual({ viewport: 1, element: 0 });
    expect(parsePoint("0-0")).toEqual({ viewport: 0, element: 0 });
    expect(parsePoint("0-100")).toEqual({ viewport: 0, element: 1 });
    expect(parsePoint("-100-0")).toEqual({ viewport: -1, element: 0 });
    expect(parsePoint("-150-0")).toEqual({ viewport: -1.5, element: 0 });
    expect(parsePoint("200-100")).toEqual({ viewport: 2, element: 1 });
    expect(parsePoint("100-50")).toEqual({ viewport: 1, element: 0.5 });
  });

  it("reads bare viewport lengths as the element's top crossing them", () => {
    expect(parsePoint("90svh")).toEqual({ viewport: 0.9, element: 0 });
    expect(parsePoint("-150%")).toEqual(parsePoint("-150-0"));
    expect(parsePoint(" 18vh ")).toEqual({ viewport: 0.18, element: 0 });
  });

  it("rejects anything else", () => {
    expect(() => parsePoint("top")).toThrow();
    expect(() => parsePoint("100px")).toThrow();
    expect(() => parsePoint("")).toThrow();
  });
});

describe("parseRange", () => {
  it("takes an arrow or a pair", () => {
    const expected = [
      { viewport: -1.5, element: 0 },
      { viewport: -2.5, element: 0 },
    ];
    expect(parseRange("-150-0 → -250-0")).toEqual(expected);
    expect(parseRange("-150-0->-250-0")).toEqual(expected);
    expect(parseRange(["-150-0", "-250-0"])).toEqual(expected);
  });

  it("needs two points", () => {
    expect(() => parseRange("100-0")).toThrow();
    expect(() => parseRange("100-0 → 0-0 → 0-100")).toThrow();
  });
});

describe("scrollAt and rangeProgress", () => {
  it("places points where the notation says", () => {
    // Top at the viewport's bottom: one viewport before the top reaches 0.
    expect(scrollAt(parsePoint("100-0"), geometry)).toBe(1800);
    expect(scrollAt(parsePoint("0-0"), geometry)).toBe(2700);
    // Bottom at the top: gone.
    expect(scrollAt(parsePoint("0-100"), geometry)).toBe(4500);
    expect(scrollAt(parsePoint("-150-0"), geometry)).toBe(4050);
    expect(scrollAt(parsePoint("90svh"), geometry)).toBe(1890);
  });

  it("runs 0 → 1 through the range and clamps outside it", () => {
    const range = parseRange("100-0 → 0-0");
    expect(rangeProgress(range, geometry, 1800)).toBe(0);
    expect(rangeProgress(range, geometry, 2250)).toBe(0.5);
    expect(rangeProgress(range, geometry, 2700)).toBe(1);
    expect(rangeProgress(range, geometry, 0)).toBe(0);
    expect(rangeProgress(range, geometry, 9000)).toBe(1);
  });

  it("runs past 0…1 when unclamped (the wordmark peel)", () => {
    const range = parseRange("0-0 → -100-0");
    expect(rangeProgress(range, geometry, 2700 + 1350, false)).toBe(1.5);
    expect(rangeProgress(range, geometry, 2700 - 450, false)).toBe(-0.5);
  });

  it("treats an empty range as a step", () => {
    const range = parseRange("0-0 → 0-0");
    expect(rangeProgress(range, geometry, 2699)).toBe(0);
    expect(rangeProgress(range, geometry, 2700)).toBe(1);
  });

  it("counts the points passed, for thresholds and swaps", () => {
    const points = ["-85%", "-150%"].map(parsePoint);
    expect(pointsPassed(points, geometry, 0)).toBe(0);
    expect(pointsPassed(points, geometry, 2700 + 765)).toBe(1);
    expect(pointsPassed(points, geometry, 2700 + 1350)).toBe(2);
  });

  it("gives the reference's eased hero panel (A5) on its 1 vh range", () => {
    // Panel clip left 66.66 % → 0, quadOut: 46.2 % at 150 px, 7.4 % at 600 px.
    const range = parseRange("0-0 → -100-0");
    const hero: Geometry = { top: 0, height: 1800, viewport: 900 };
    const left = interpolate("inset(0 0 0 66.66%)", "inset(0 0 0 0%)");
    const at = (y: number) => left(scrubEase.quadOut(rangeProgress(range, hero, y)));
    expect(at(150)).toBe("inset(0 0 0 46.2917%)");
    expect(at(600)).toBe("inset(0 0 0 7.4067%)");
    expect(at(900)).toBe("inset(0 0 0 0)");
  });
});

describe("interpolate", () => {
  it("mixes numbers and lengths", () => {
    expect(interpolate(0, 1)(0.25)).toBe("0.25");
    expect(interpolate("0.85", "1")(0.5)).toBe("0.925");
    expect(interpolate("0 0%", "0 -30%")(0.5)).toBe("0 -15%");
    expect(interpolate("0", "-30%")(1)).toBe("-30%");
  });

  it("expands inset() shorthand to four sides", () => {
    // Centre strip (A20) and window expand (A21).
    expect(interpolate("inset(0 50%)", "inset(0)")(0.5)).toBe("inset(0 25% 0 25%)");
    expect(interpolate("inset(31.4% 25vw)", "inset(0)")(0.5)).toBe(
      "inset(15.7% 12.5vw 15.7% 12.5vw)",
    );
  });

  it("interpolates calc() term by term (the iris, A19)", () => {
    const iris = interpolate(
      "inset(50svh 50% calc(100% - 50svh) 50%)",
      "inset(0 0 calc(100% - 100svh) 0)",
    );
    expect(iris(0)).toBe("inset(50svh 50% calc(100% - 50svh) 50%)");
    expect(iris(0.5)).toBe("inset(25svh 25% calc(100% - 75svh) 25%)");
    expect(iris(1)).toBe("inset(0 0 calc(100% - 100svh) 0)");
  });

  it("interpolates polygon() point by point (the doors, A18)", () => {
    const doors = interpolate(
      "polygon(0 0,100% 0,100% 100%,50% 100%,50% 0,50% 0,50% 100%,0 100%)",
      "polygon(0 0,100% 0,100% 100%,100% 100%,100% 0,0 0,0 100%,0 100%)",
    );
    expect(doors(0)).toBe(
      "polygon(0 0, 100% 0, 100% 100%, 50% 100%, 50% 0, 50% 0, 50% 100%, 0 100%)",
    );
    expect(doors(0.5)).toBe(
      "polygon(0 0, 100% 0, 100% 100%, 75% 100%, 75% 0, 25% 0, 25% 100%, 0 100%)",
    );
  });

  it("refuses values of different shapes", () => {
    expect(() => interpolate("inset(0)", "polygon(0 0, 1% 1%)")).toThrow();
    expect(() => interpolate("0 0", "0")).toThrow();
    expect(() => interpolate("inset(0 round 4px)", "inset(0)")).toThrow();
  });

  it("has the helpers the scenes use", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp01(-1)).toBe(0);
    expect(mix(10, 20, 0.3)).toBe(13);
  });
});

describe("SplitWord", () => {
  it("keeps Azerbaijani and combined letters whole", () => {
    expect(graphemes("ƏRAZİ", "az")).toEqual(["Ə", "R", "A", "Z", "İ"]);
    // İ decomposed (I + combining dot) is still one letter.
    expect(graphemes("İSTİSU", "az")).toHaveLength(6);
    expect(graphemes("МЕСТО", "ru")).toHaveLength(5);
  });

  it("spreads as the reference's ОКНА (A14)", () => {
    expect(spreadOffsets(4)).toEqual([20, 10, -10, -20]);
    // Odd counts keep the centre letter; outer ±20, inner ±10, linear between.
    expect(spreadOffsets(5)).toEqual([20, 10, 0, -10, -20]);
    expect(spreadOffsets(7)).toEqual([20, 15, 10, 0, -10, -15, -20]);
    expect(spreadOffsets(1)).toEqual([0]);
    expect(spreadOffsets(2)).toEqual([20, -20]);
  });

  it("explodes outward, 5vw apart from ±37.5vw down to ±7.5vw (A15)", () => {
    expect(explodeOffsets(10)).toEqual([
      -37.5, -32.5, -27.5, -22.5, -17.5, 17.5, 22.5, 27.5, 32.5, 37.5,
    ]);
    expect(explodeOffsets(5)).toEqual([-37.5, -32.5, 0, 32.5, 37.5]);
    const long = explodeOffsets(16);
    expect(Math.min(...long.map(Math.abs))).toBe(7.5);
    // Symmetric for every count, so any locale's word works.
    for (let n = 1; n < 20; n++) {
      const offsets = explodeOffsets(n);
      offsets.forEach((x, i) => expect(x + offsets[n - 1 - i]!).toBe(0));
    }
  });

  it("climbs a staircase of (i + 1) · 2vw (A16)", () => {
    expect(staircaseOffsets(7)).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });
});

describe("hero snap (A43)", () => {
  const vh = 900;

  it("snaps forward once a wheel turn reaches a fifth of a viewport", () => {
    expect(heroSnapTarget(0, 100, vh)).toBeNull();
    expect(heroSnapTarget(0, 180, vh)).toBe(vh);
    expect(heroSnapTarget(100, 100, vh)).toBe(vh);
  });

  it("snaps back to the top when scrolling up into the hero", () => {
    expect(heroSnapTarget(vh, -50, vh)).toBe(0);
    expect(heroSnapTarget(400, -10, vh)).toBe(0);
    expect(heroSnapTarget(0, -100, vh)).toBeNull();
  });

  it("leaves the rest of the page alone", () => {
    expect(heroSnapTarget(vh, 100, vh)).toBeNull();
    expect(heroSnapTarget(3000, -100, vh)).toBeNull();
    expect(heroSnapTarget(vh + 200, -100, vh)).toBeNull();
    expect(heroSnapTarget(0, 0, vh)).toBeNull();
  });

  it("settles a free scroll inside the hero on the near side of the threshold", () => {
    expect(heroSnapSettle(100, vh)).toBe(0);
    expect(heroSnapSettle(200, vh)).toBe(vh);
    expect(heroSnapSettle(0, vh)).toBeNull();
    expect(heroSnapSettle(vh, vh)).toBeNull();
    expect(heroSnapSettle(2000, vh)).toBeNull();
  });
});
