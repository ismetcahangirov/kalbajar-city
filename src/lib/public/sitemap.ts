import "server-only";

import { desc, eq, inArray, max } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import {
  apartments,
  constructionUpdates,
  galleryItems,
  homeSections,
  layoutTypes,
  news,
  settings,
} from "@/db/schema";
import { publicTags } from "@/lib/cache/tags";
import type { SitemapData } from "@/lib/seo/sitemap";
import { publicApartmentStatuses } from "@/shared/apartments";

import { listNoindexPaths } from "./seo";

const latest = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** Every indexable URL's data and when it last changed, for the per-locale sitemaps. */
export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheTag(publicTags.settings, publicTags.inventory, publicTags.content);
  cacheLife("hours");

  const db = getDb();
  const listed = inArray(apartments.status, [...publicApartmentStatuses]);

  const [
    apartmentRows,
    roomRows,
    newsRows,
    [settingsRow],
    [sectionsRow],
    [constructionRow],
    [galleryRow],
    noindex,
  ] = await Promise.all([
    db
      .select({ slug: apartments.slug, updatedAt: apartments.updatedAt })
      .from(apartments)
      .where(listed)
      .orderBy(apartments.slug),
    db
      .select({ rooms: layoutTypes.rooms, updatedAt: max(apartments.updatedAt) })
      .from(apartments)
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(listed)
      .groupBy(layoutTypes.rooms)
      .orderBy(layoutTypes.rooms),
    db
      .select({ slug: news.slug, updatedAt: news.updatedAt })
      .from(news)
      .where(eq(news.status, "published"))
      .orderBy(desc(news.publishedAt)),
    db.select({ at: max(settings.updatedAt) }).from(settings),
    db.select({ at: max(homeSections.updatedAt) }).from(homeSections),
    db
      .select({ at: max(constructionUpdates.updatedAt) })
      .from(constructionUpdates)
      .where(eq(constructionUpdates.status, "published")),
    db
      .select({ at: max(galleryItems.updatedAt) })
      .from(galleryItems)
      .where(eq(galleryItems.status, "published")),
    listNoindexPaths(),
  ]);

  return {
    apartments: apartmentRows.map((row) => ({ slug: row.slug, updatedAt: latest(row.updatedAt) })),
    roomCounts: roomRows.map((row) => ({ rooms: row.rooms, updatedAt: latest(row.updatedAt) })),
    news: newsRows.map((row) => ({ slug: row.slug, updatedAt: latest(row.updatedAt) })),
    settingsUpdatedAt: latest(settingsRow?.at),
    homeUpdatedAt: latest(sectionsRow?.at),
    constructionUpdatedAt: latest(constructionRow?.at),
    galleryUpdatedAt: latest(galleryRow?.at),
    noindex,
  };
}
