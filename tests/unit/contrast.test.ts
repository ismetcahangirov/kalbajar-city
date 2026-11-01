import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Re-checks WCAG 2.2 AA for every text/surface pair the semantic tokens can
// produce, reading the values from the token file itself, so changing a token
// re-runs the check. Decorative pairs (gold and stone-200 on light) are
// deliberately absent: docs/ui-kit.md forbids them as text or cues.

const css = readFileSync(
  fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
  "utf8",
);

function declarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    if (name && value) map.set(name, value.trim());
  }
  return map;
}

function block(selector: RegExp): string {
  const match = css.match(selector);
  if (!match?.[1]) throw new Error(`token block not found: ${selector}`);
  return match[1];
}

const light = declarations(block(/@theme static \{([\s\S]*?)\n\}/));
const night = new Map([
  ...light,
  ...declarations(block(/\[data-tone="night"\][^{]*\{([\s\S]*?)\n\}/)),
]);

function resolve(tokens: Map<string, string>, name: string, depth = 0): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`unknown token ${name}`);
  const reference = value.match(/^var\((--color-[\w-]+)\)$/);
  if (reference?.[1]) {
    if (depth > 4) throw new Error(`token cycle at ${name}`);
    // Palette tokens are never redefined per tone, so resolve them from :root.
    return resolve(light, reference[1], depth + 1);
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a hex colour: ${value}`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const surfaces = ["--color-surface", "--color-surface-alt", "--color-surface-raised"];
const text = ["--color-text", "--color-text-muted", "--color-text-accent"];
// Non-text UI that must be perceivable: input borders, icons, the focus ring.
const nonText = ["--color-border-strong", "--color-focus"];
// Status and error colours are defined for light surfaces only.
const lightOnly = [
  "--color-status-available",
  "--color-status-reserved",
  "--color-status-sold",
  "--color-error",
];

type Pair = { fg: string; bg: string; min: number };

function pairs(tone: "light" | "night"): Pair[] {
  const fgText = tone === "light" ? [...text, ...lightOnly] : text;
  return [
    ...fgText.flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: 4.5 }))),
    ...nonText.flatMap((fg) => surfaces.map((bg) => ({ fg, bg, min: 3 }))),
    { fg: "--color-action-text", bg: "--color-action", min: 4.5 },
    // The secondary button's text sits on the hover fill.
    { fg: "--color-text", bg: "--color-surface-alt", min: 4.5 },
  ];
}

describe.each([
  ["light", light],
  ["night", night],
] as const)("contrast on %s surfaces", (tone, tokens) => {
  it.each(pairs(tone).map((p) => [p.fg, p.bg, p.min] as const))(
    "%s on %s is at least %s : 1",
    (fg, bg, min) => {
      const ratio = contrast(resolve(tokens, fg), resolve(tokens, bg));
      expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    },
  );
});

describe("contrast formula", () => {
  it("matches the measured table in docs/ui-kit.md", () => {
    expect(contrast("#22201d", "#f5f2ec")).toBeCloseTo(14.54, 1);
    expect(contrast("#7e5f2c", "#eae4d9")).toBeCloseTo(4.66, 1);
    expect(contrast("#b38b4d", "#f5f2ec")).toBeCloseTo(2.8, 1);
  });
});
