import localFont from "next/font/local";

// Alethia Next, subset to Latin, Latin Extended and Cyrillic (docs/ui-kit.md).
// The Light file declares weight 350; it is served as 300 so `font-light`
// selects it. The fallback faces are metric-matched by hand in
// src/styles/font-fallback.css: next/font's automatic one reads the wrong
// vertical metrics for this font.
export const alethia = localFont({
  src: [
    { path: "../fonts/alethia-next/AlethiaNext-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/alethia-next/AlethiaNext-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/alethia-next/AlethiaNext-Medium.woff2", weight: "500", style: "normal" },
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
