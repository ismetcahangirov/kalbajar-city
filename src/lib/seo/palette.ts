/** The colours an Open Graph card uses, read from `src/styles/tokens.css` (`./og.tsx`). */
export type PaletteName = "ink" | "cream" | "sand" | "sand-hover" | "taupe";

/** The palette tokens a card uses, resolved to their values. */
export function parsePalette(css: string): Record<PaletteName, string> {
  const names: PaletteName[] = ["ink", "cream", "sand", "sand-hover", "taupe"];
  const palette = {} as Record<PaletteName, string>;
  for (const name of names) {
    const value = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`))?.[1]?.trim();
    if (!value) throw new Error(`tokens.css has no --color-${name}`);
    palette[name] = value;
  }
  return palette;
}
