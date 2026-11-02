import type { media } from "@/db/schema";
import { localize } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import type { MediaVariant, VariantFormat } from "@/shared/media";

type MediaRow = typeof media.$inferSelect;

/** One `<source>` of a `<picture>`: every width of one format. */
export type PublicImageSource = { type: `image/${VariantFormat}`; srcSet: string };

/** An image ready to render: everything a page needs, nothing it must look up. */
export type PublicImage = {
  /** The fallback `<img src>`: a mid-sized WebP variant. */
  src: string;
  /** The original's size after rotation: the intrinsic aspect ratio. */
  width: number;
  height: number;
  /** Empty for a decorative image. */
  alt: string;
  /** `object-position` from the library's focus point. */
  position: string;
  blurDataURL: string | null;
  /** Painted behind the image while it loads, when there is no blur placeholder. */
  dominantColor: string | null;
  /** AVIF first, then WebP; empty for a file stored before the pipeline (#11). */
  sources: PublicImageSource[];
  /** A generated or otherwise illustrative image, shown with the "Illustrative" chip. */
  illustrative: boolean;
};

/** A stored MP4. Width and height size its frame before it loads; null for a file without them. */
export type PublicVideo = {
  src: string;
  type: string;
  width: number | null;
  height: number | null;
};

/** The fallback is the sharpest WebP at most this wide: good enough for any browser without srcset. */
const fallbackWidth = 1600;

/**
 * The public URL of a stored file. Only `media/*` is public-read (#11,
 * `pnpm storage:setup`); originals stay private.
 */
export function mediaUrl(key: string): string | null {
  const base = process.env.S3_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * An image as pages render it, or null when it must not be shown: not an
 * image, no size, or no Azerbaijani alt text while not marked decorative.
 * That is how "alt text before an image is published" holds: the console
 * flags such a file (`missingAlt`) and the public site leaves it out.
 */
export function toPublicImage(row: MediaRow | undefined, locale: Locale): PublicImage | null {
  if (!row || row.kind !== "image" || !row.width || !row.height) return null;
  if (!row.decorative && !row.alt?.az?.trim()) return null;

  const sources = (["avif", "webp"] as const).flatMap((format): PublicImageSource[] => {
    const candidates = byWidth(row.variants.filter((variant) => variant.format === format));
    const srcSet = candidates
      .flatMap((variant) => {
        const url = mediaUrl(variant.key);
        return url ? [`${url} ${variant.width}w`] : [];
      })
      .join(", ");
    return srcSet ? [{ type: `image/${format}`, srcSet }] : [];
  });

  const webp = byWidth(row.variants.filter((variant) => variant.format === "webp"));
  const fallback = webp.filter((variant) => variant.width <= fallbackWidth).at(-1) ?? webp[0];
  const src = mediaUrl(fallback?.key ?? row.key);
  if (!src) return null;

  return {
    src,
    width: row.width,
    height: row.height,
    alt: row.decorative || !row.alt ? "" : localize(row.alt, locale).value,
    position: `${round(row.focusX * 100)}% ${round(row.focusY * 100)}%`,
    blurDataURL: row.lqip,
    dominantColor: row.dominantColor,
    sources,
    illustrative: row.illustrative || row.source === "generated",
  };
}

export function toPublicVideo(row: MediaRow | undefined): PublicVideo | null {
  if (!row || row.kind !== "video") return null;
  const src = mediaUrl(row.key);
  return src ? { src, type: row.mimeType, width: row.width, height: row.height } : null;
}

function byWidth(variants: MediaVariant[]): MediaVariant[] {
  return [...variants].sort((a, b) => a.width - b.width);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
