import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Re-checks WCAG 2.2 AA for every text/surface pair docs/ui-kit.md allows,
// reading the values from the token file itself, so changing a token re-runs
// the check. Text needs 4.5 : 1; large text (24 px and up, or 18.66 px
// Medium) and non-text UI (borders, icons, the focus ring) need 3 : 1.
// Decorative pairs are deliberately absent: the light theme's
// `--t-secondary` (sand on cream, 1.80 : 1) is only for aria-hidden giant
// words, and `--color-border` / `--t-line` are hairlines that carry nothing.

const css = readFileSync(
  fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
  "utf8",
);

function declarations(block: string, prefix = "--color-"): Map<string, string> {
  const map = new Map<string, string>();
  const pattern = new RegExp(`(${prefix}[\\w-]+):\\s*([^;]+);`, "g");
  for (const [, name, value] of block.matchAll(pattern)) {
    if (name && value) map.set(name, value.trim());
  }
  return map;
}

function block(selector: RegExp): string {
  const match = css.match(selector);
  if (!match?.[1]) throw new Error(`token block not found: ${selector}`);
  return match[1];
}

const palette = declarations(block(/@theme static \{([\s\S]*?)\n\}/));

/** Resolves a token through `var()` references to its hex value. */
function resolve(tokens: Map<string, string>, name: string, depth = 0): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`unknown token ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  if (reference?.[1]) {
    if (depth > 4) throw new Error(`token cycle at ${name}`);
    // Palette tokens are never redefined per tone or theme, so resolve them
    // from the palette.
    return resolve(palette, reference[1], depth + 1);
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a hex colour: ${value}`);
  return value;
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A point on a two-stop gradient, interpolated in sRGB like the browser does. */
function mix(from: string, to: string, t: number): string {
  const b = channels(to);
  const hex = channels(from).map((c, i) =>
    Math.round(c + ((b[i] ?? c) - c) * t)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${hex.join("")}`;
}

type Pair = { fg: string; bg: string; min: number };
const TEXT = 4.5;
const LARGE = 3;

describe("the semantic tokens (current components and the console)", () => {
  const surfaces = ["--color-surface", "--color-surface-alt", "--color-surface-raised"];
  const text = ["--color-text", "--color-text-muted", "--color-text-accent"];
  // Non-text UI that must be perceivable: input borders, icons, the focus ring.
  const nonText = ["--color-border-strong", "--color-focus"];
  // Status and error colours are defined for light surfaces only.
  const status = ["--color-status-available", "--color-status-reserved", "--color-status-sold"];

  function pairs(): Pair[] {
    return [
      ...[...text, ...status, "--color-error"].flatMap((fg) =>
        surfaces.map((bg) => ({ fg, bg, min: TEXT })),
      ),
      ...nonText.flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: LARGE }))),
      { fg: "--color-action-text", bg: "--color-action", min: TEXT },
    ];
  }

  it.each(pairs().map((p) => [p.fg, p.bg, p.min] as const))(
    "%s on %s is at least %s : 1",
    (fg, bg, min) => {
      const ratio = contrast(resolve(palette, fg), resolve(palette, bg));
      expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    },
  );

  it("keeps the three statuses three different colours", () => {
    // The word always shows (colour never stands alone); the colours differ too.
    expect(new Set(status.map((name) => resolve(palette, name))).size).toBe(3);
  });
});

describe("the themes (new components)", () => {
  const themes = ["light", "dark", "darker", "dark-alt", "sand"] as const;
  type Theme = (typeof themes)[number];

  function theme(name: Theme): Map<string, string> {
    const selector =
      name === "light"
        ? /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/
        : new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
    return declarations(block(selector), "--t-");
  }

  function pairs(name: Theme): Pair[] {
    return [
      { fg: "--t-text", bg: "--t-bg", min: TEXT },
      { fg: "--t-small", bg: "--t-bg", min: TEXT },
      { fg: "--t-heading", bg: "--t-bg", min: LARGE },
      { fg: "--t-primary", bg: "--t-bg", min: LARGE },
      // Decoration only on light; large text everywhere else.
      ...(name === "light" ? [] : [{ fg: "--t-secondary", bg: "--t-bg", min: LARGE }]),
      // Input and checkbox boundaries. The focus ring is drawn in --t-text.
      { fg: "--t-control", bg: "--t-bg", min: LARGE },
    ];
  }

  it("defines the same tokens in every theme", () => {
    const names = [...theme("light").keys()].sort();
    expect(names).toEqual(
      [
        "--t-bg",
        "--t-control",
        "--t-heading",
        "--t-line",
        "--t-line-alt",
        "--t-primary",
        "--t-secondary",
        "--t-small",
        "--t-text",
      ].sort(),
    );
    for (const name of themes) expect([...theme(name).keys()].sort(), name).toEqual(names);
  });

  describe.each(themes)("%s", (name) => {
    const tokens = theme(name);
    it.each(pairs(name).map((p) => [p.fg, p.bg, p.min] as const))(
      "%s on %s is at least %s : 1",
      (fg, bg, min) => {
        const ratio = contrast(resolve(tokens, fg), resolve(tokens, bg));
        expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
      },
    );
  });

  describe("on the curtain gradient (ink to umber over 100svh, dark theme)", () => {
    const ink = resolve(palette, "--color-ink");
    const umber = resolve(palette, "--color-umber");
    const dark = theme("dark");

    it("passes for --t-text at every point, down to the umber end", () => {
      expect(contrast(resolve(dark, "--t-text"), umber)).toBeGreaterThanOrEqual(TEXT);
    });

    it("passes for --t-small over the top 70svh only", () => {
      const small = resolve(dark, "--t-small");
      expect(contrast(small, mix(ink, umber, 0.7))).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(small, mix(ink, umber, 0.8))).toBeLessThan(TEXT);
    });

    it("passes for large --t-primary text at every point", () => {
      expect(contrast(resolve(dark, "--t-primary"), umber)).toBeGreaterThanOrEqual(LARGE);
    });
  });

  it("allows the error colour as text on light, as a border or icon on sand", () => {
    const error = resolve(palette, "--color-error");
    expect(contrast(error, resolve(theme("light"), "--t-bg"))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(error, resolve(theme("sand"), "--t-bg"))).toBeGreaterThanOrEqual(LARGE);
  });
});

describe("contrast formula", () => {
  it("matches the measured table in docs/ui-kit.md", () => {
    expect(contrast("#12100e", "#f7f2e8")).toBeCloseTo(17.01, 1);
    expect(contrast("#75736d", "#f7f2e8")).toBeCloseTo(4.25, 1);
    expect(contrast("#bdb6a9", "#12100e")).toBeCloseTo(9.43, 1);
    expect(contrast("#bdb6a9", "#f7f2e8")).toBeCloseTo(1.8, 1);
  });
});
