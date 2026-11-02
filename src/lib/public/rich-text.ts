import { inArray } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { media } from "@/db/schema";
import type { Locale } from "@/i18n/routing";
import {
  richTextMediaIds,
  sanitizeRichText,
  type RichBlock,
  type TranslatableRichText,
} from "@/shared/rich-text";

import { posterIds, toPublicImage, type PublicImage } from "./media";

type MediaRow = typeof media.$inferSelect;

/**
 * A rich-text field ready to render: the sanitised blocks in the page's
 * language, or in Azerbaijani when that translation is missing (then
 * `fallback` is set and the text carries `lang="az"`), and the images it
 * embeds that may be shown.
 */
export type PublicRichText = {
  blocks: RichBlock[];
  locale: Locale;
  fallback: boolean;
  images: Record<string, PublicImage>;
};

/** Library rows by id, in one query. */
export async function mediaById(
  db: Executor,
  ids: Iterable<string>,
): Promise<Map<string, MediaRow>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await db.select().from(media).where(inArray(media.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

/** `files` with its videos' posters added, so `toPublicVideo` can show them. */
export async function withPosters(
  db: Executor,
  files: Map<string, MediaRow>,
): Promise<Map<string, MediaRow>> {
  const missing = posterIds(files.values()).filter((id) => !files.has(id));
  if (!missing.length) return files;
  return new Map([...files, ...(await mediaById(db, missing))]);
}

/** The sanitised document for the locale, before its images are looked up. */
export function localizeRichText(
  field: TranslatableRichText,
  locale: Locale,
): { blocks: RichBlock[]; locale: Locale; fallback: boolean } {
  const own = locale === "az" ? [] : sanitizeRichText(field[locale]);
  if (own.length) return { blocks: own, locale, fallback: false };
  return { blocks: sanitizeRichText(field.az), locale: "az", fallback: locale !== "az" };
}

/** Attaches the embedded images a page may show; the rest are left out when rendering. */
export function withImages(
  text: { blocks: RichBlock[]; locale: Locale; fallback: boolean },
  files: Map<string, MediaRow>,
  locale: Locale,
): PublicRichText {
  const images: Record<string, PublicImage> = {};
  for (const id of richTextMediaIds(text.blocks)) {
    const image = toPublicImage(files.get(id), locale);
    if (image) images[id] = image;
  }
  return { ...text, images };
}

/** The first paragraph's text, cut at a word near `max` characters: a fallback summary. */
export function summary(blocks: RichBlock[], max = 180): string | null {
  const paragraph = blocks.find((block) => block.type === "paragraph");
  if (!paragraph) return null;
  const text = paragraph.content
    .map((run) => (run.type === "text" ? run.text : " "))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}
