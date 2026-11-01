import type { media } from "@/db/schema";
import { localize } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";

type MediaRow = typeof media.$inferSelect;

/** An image ready to render: everything a page needs, nothing it must look up. */
export type PublicImage = {
  src: string;
  width: number;
  height: number;
  /** Empty for a decorative image. */
  alt: string;
  /** `object-position` from the library's focus point. */
  position: string;
  blurDataURL: string | null;
  /** A generated image: atmosphere only, shown with the "Illustrative" chip. */
  illustrative: boolean;
};

export type PublicVideo = { src: string; type: string };

/**
 * The public URL of a stored file. The bucket is public-read (see
 * docker-compose.yml); #11 adds resized variants and replaces this with them.
 */
export function mediaUrl(key: string): string | null {
  const base = process.env.S3_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function toPublicImage(row: MediaRow | undefined, locale: Locale): PublicImage | null {
  if (!row || row.kind !== "image" || !row.width || !row.height) return null;
  const src = mediaUrl(row.key);
  if (!src) return null;
  return {
    src,
    width: row.width,
    height: row.height,
    alt: row.alt ? localize(row.alt, locale).value : "",
    position: `${round(row.focusX * 100)}% ${round(row.focusY * 100)}%`,
    blurDataURL: row.lqip,
    illustrative: row.source === "generated",
  };
}

export function toPublicVideo(row: MediaRow | undefined): PublicVideo | null {
  if (!row || row.kind !== "video") return null;
  const src = mediaUrl(row.key);
  return src ? { src, type: row.mimeType } : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
