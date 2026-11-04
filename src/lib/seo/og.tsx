import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { ogImageSize } from "./metadata";
import { parsePalette, type PaletteName } from "./palette";
import { siteOrigin } from "./url";

/**
 * Open Graph cards (1200 × 630 PNG) in Alethia Next. Satori cannot read
 * WOFF2, so the cards use the OpenType files in `src/fonts/alethia-next/og`;
 * the colours are read from `src/styles/tokens.css`, the only place a colour
 * is written. Both are read from disk at run time (the standalone build
 * traces them through `outputFileTracingIncludes` in `next.config.ts`).
 */

const fontDir = join(process.cwd(), "src/fonts/alethia-next/og");
const tokenFile = join(process.cwd(), "src/styles/tokens.css");

let assets: Promise<{
  fonts: Array<{ name: string; data: Buffer; weight: 400 | 500; style: "normal" }>;
  palette: Record<PaletteName, string>;
}> | null = null;

function loadAssets() {
  assets ??= Promise.all([
    readFile(join(fontDir, "AlethiaNext-Regular.otf")),
    readFile(join(fontDir, "AlethiaNext-Medium.otf")),
    readFile(tokenFile, "utf8"),
  ]).then(([regular, medium, css]) => ({
    fonts: [
      { name: "Alethia Next", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Alethia Next", data: medium, weight: 500 as const, style: "normal" as const },
    ],
    palette: parsePalette(css),
  }));
  // A failed read is retried on the next request instead of being cached.
  assets.catch(() => (assets = null));
  return assets;
}

export type OgCard = {
  /** The small line above the title: the site name or a section. */
  eyebrow: string;
  title: string;
  /** Facts in one line under the title, such as rooms, area and status. */
  details?: string[];
};

/** A card: ink background, sand eyebrow, the title large, details, the site's host. */
export async function ogImage({ eyebrow, title, details = [] }: OgCard): Promise<ImageResponse> {
  const { fonts, palette } = await loadAssets();
  const host = new URL(siteOrigin()).host;
  const titleSize = title.length > 60 ? 64 : title.length > 30 ? 80 : 104;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: palette.ink,
        color: palette.cream,
        fontFamily: "Alethia Next",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: palette["sand-hover"],
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        {details.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 36, color: palette.sand }}>
            {details.join("  ·  ")}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `2px solid ${palette.taupe}`,
          paddingTop: 28,
          fontSize: 28,
          color: palette.sand,
        }}
      >
        <span>{host}</span>
      </div>
    </div>,
    { ...ogImageSize, fonts },
  );
}
