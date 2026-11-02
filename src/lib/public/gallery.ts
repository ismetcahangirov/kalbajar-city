import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import type { Executor } from "@/db/client";
import { galleryCategories, galleryItems } from "@/db/schema";
import { localize, type Localized } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";

import { toPublicImage, type PublicImage } from "./media";
import { mediaById } from "./rich-text";

export type PublicGalleryCategory = { slug: string; name: Localized; count: number };

export type PublicGalleryItem = {
  id: string;
  /** The category's slug. */
  category: string;
  image: PublicImage;
  /** The item's own caption, else the file's. */
  caption: Localized | null;
};

export type PublicGallery = { categories: PublicGalleryCategory[]; items: PublicGalleryItem[] };

/**
 * Every published gallery image in category order, and the categories that
 * have at least one. Items whose file may not be shown (no alt text, a video)
 * are left out, and so is a category left empty by that.
 */
export async function loadGallery(db: Executor, locale: Locale): Promise<PublicGallery> {
  const rows = await db
    .select({
      id: galleryItems.id,
      mediaId: galleryItems.mediaId,
      caption: galleryItems.caption,
      category: galleryCategories.slug,
      categoryName: galleryCategories.name,
    })
    .from(galleryItems)
    .innerJoin(galleryCategories, eq(galleryCategories.id, galleryItems.categoryId))
    .where(eq(galleryItems.status, "published"))
    .orderBy(
      asc(galleryCategories.sortOrder),
      asc(galleryCategories.slug),
      asc(galleryItems.sortOrder),
      asc(galleryItems.createdAt),
    );

  const files = await mediaById(
    db,
    rows.map((row) => row.mediaId),
  );
  const categories = new Map<string, PublicGalleryCategory>();
  const items = rows.flatMap((row): PublicGalleryItem[] => {
    const file = files.get(row.mediaId);
    const image = toPublicImage(file, locale);
    if (!image) return [];
    const category = categories.get(row.category) ?? {
      slug: row.category,
      name: localize(row.categoryName, locale),
      count: 0,
    };
    category.count++;
    categories.set(row.category, category);
    const caption = row.caption ?? file?.caption;
    return [
      {
        id: row.id,
        category: row.category,
        image,
        caption: caption ? localize(caption, locale) : null,
      },
    ];
  });
  return { categories: [...categories.values()], items };
}

/** `/qalereya`'s data, cached until the console changes content or media. */
export async function getGallery(locale: Locale): Promise<PublicGallery> {
  "use cache";
  cacheTag(publicTags.content, publicTags.media);
  cacheLife("days");
  return loadGallery(getDb(), locale);
}
