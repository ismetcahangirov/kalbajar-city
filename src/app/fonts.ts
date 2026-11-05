import localFont from "next/font/local";

// Alethia Next, split per weight by scripts/fonts-subset.py (docs/ui-kit.md).
// The files here cover Azerbaijani and English; the Cyrillic and rare Latin
// ones are in src/styles/font-ranges.css, fetched only when a page uses them.
// The Light file declares weight 350; it is served as 300 so `font-light`
// selects it. The fallback faces are metric-matched by hand in
// src/styles/font-fallback.css: next/font's automatic one reads the wrong
// vertical metrics for this font.

export const alethia = localFont({
  src: [
    { path: "../fonts/alethia-next/AlethiaNext-Light-Core.woff2", weight: "300", style: "normal" },
    {
      path: "../fonts/alethia-next/AlethiaNext-Regular-Core.woff2",
      weight: "400",
      style: "normal",
    },
    { path: "../fonts/alethia-next/AlethiaNext-Medium-Core.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-alethia",
  display: "swap",
  fallback: ["Alethia Fallback"],
  adjustFontFallback: false,
});

// Used for one emphasised phrase at most, so it is not preloaded.
export const alethiaItalic = localFont({
  src: [{ path: "../fonts/alethia-next/AlethiaNext-Italic.woff2", weight: "400", style: "italic" }],
  variable: "--font-alethia-italic",
  display: "swap",
  preload: false,
  fallback: ["Alethia Italic Fallback"],
  adjustFontFallback: false,
});
