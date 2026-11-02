import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { media, seoOverrides } from "@/db/schema";
import type { Translatable } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import type { SeoOverride } from "@/lib/seo/metadata";

import { toPublicImage } from "./media";

/** A translation in this locale only: an Azerbaijani title on the English page would be wrong. */
function own(field: Translatable | null, locale: Locale): string | null {
  const value = field?.[locale]?.trim();
  return value ? value : null;
}

/**
 * The console's override for one path (`seo_overrides`, keyed by the
 * Azerbaijani path without a locale prefix), or null. Tagged `settings` and
 * `media`: the SEO screen (#27) revalidates `settings` when it writes.
 */
export async function getSeoOverride(path: string, locale: Locale): Promise<SeoOverride | null> {
  "use cache";
  cacheTag(publicTags.settings, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [row] = await db
    .select({ override: seoOverrides, image: media })
    .from(seoOverrides)
    .leftJoin(media, eq(media.id, seoOverrides.ogMediaId))
    .where(eq(seoOverrides.path, path));
  if (!row) return null;
  const { override, image } = row;
  return {
    title: own(override.title, locale),
    description: own(override.description, locale),
    noindex: override.noindex,
    image: toPublicImage(image ?? undefined, locale)?.src ?? null,
  };
}

/** Paths the console marked `noindex`; the sitemaps leave them out. */
export async function listNoindexPaths(): Promise<string[]> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("days");

  const rows = await getDb()
    .select({ path: seoOverrides.path })
    .from(seoOverrides)
    .where(eq(seoOverrides.noindex, true));
  return rows.map((row) => row.path);
}
