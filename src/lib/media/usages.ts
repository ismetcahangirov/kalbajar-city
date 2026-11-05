import { eq, sql } from "drizzle-orm";

import type { Executor } from "@/db/client";
import {
  blocks,
  constructionUpdateMedia,
  constructionUpdates,
  floors,
  galleryItems,
  homeSections,
  layoutTypes,
  media,
  mediaUsages as mediaUsageRows,
  news,
  selectorViews,
  seoOverrides,
  settings,
} from "@/db/schema";
import type { MediaUsage } from "@/shared/media";

/**
 * Every place a file is used, computed live (#11): each foreign key to
 * `media` (a video's poster too, #25), the media ids inside home sections'
 * and settings' JSON (the developer's logo, #27), and `media_usages` rows
 * (kept for embeds in rich text). A new column that references `media` must
 * be added here, or the library would let a used file be deleted; the foreign
 * keys' `restrict` still stops that at the database.
 */
export async function mediaUsages(db: Executor, id: string): Promise<MediaUsage[]> {
  const [
    floorRows,
    layoutRows,
    newsRows,
    galleryRows,
    updateRows,
    seoRows,
    sectionRows,
    settingRows,
    videoRows,
    rows,
    viewRows,
  ] = await Promise.all([
    db
      .select({ id: floors.id, number: floors.number, block: blocks.code })
      .from(floors)
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .where(eq(floors.planMediaId, id)),
    db
      .select({ id: layoutTypes.id, code: layoutTypes.code })
      .from(layoutTypes)
      .where(eq(layoutTypes.planMediaId, id)),
    db.select({ id: news.id, slug: news.slug }).from(news).where(eq(news.coverMediaId, id)),
    db.select({ id: galleryItems.id }).from(galleryItems).where(eq(galleryItems.mediaId, id)),
    db
      .selectDistinct({ id: constructionUpdates.id, slug: constructionUpdates.slug })
      .from(constructionUpdateMedia)
      .innerJoin(constructionUpdates, eq(constructionUpdates.id, constructionUpdateMedia.updateId))
      .where(eq(constructionUpdateMedia.mediaId, id)),
    db
      .select({ id: seoOverrides.id, path: seoOverrides.path })
      .from(seoOverrides)
      .where(eq(seoOverrides.ogMediaId, id)),
    // A uuid in text form cannot match part of another value, so a text
    // search finds every section that mentions it; the paths come from the JSON.
    db
      .select({ id: homeSections.id, key: homeSections.key, content: homeSections.content })
      .from(homeSections)
      .where(sql`${homeSections.content}::text like ${`%"${id}"%`}`),
    db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(sql`${settings.value}::text like ${`%"${id}"%`}`),
    db
      .select({ id: media.id, name: media.originalName })
      .from(media)
      .where(eq(media.posterMediaId, id)),
    db
      .select({
        entityType: mediaUsageRows.entityType,
        entityId: mediaUsageRows.entityId,
        field: mediaUsageRows.field,
      })
      .from(mediaUsageRows)
      .where(eq(mediaUsageRows.mediaId, id)),
    // The complex selector's site render and block facades (#19).
    db
      .select({ id: selectorViews.id, block: blocks.code })
      .from(selectorViews)
      .leftJoin(blocks, eq(blocks.id, selectorViews.blockId))
      .where(eq(selectorViews.mediaId, id)),
  ]);

  return [
    ...floorRows.map((row) => ({
      entityType: "floor",
      entityId: row.id,
      field: "plan",
      label: `${row.block} · ${row.number}`,
    })),
    ...layoutRows.map((row) => ({
      entityType: "layout_type",
      entityId: row.id,
      field: "plan",
      label: row.code,
    })),
    ...newsRows.map((row) => ({
      entityType: "news",
      entityId: row.id,
      field: "cover",
      label: row.slug,
    })),
    ...galleryRows.map((row) => ({
      entityType: "gallery_item",
      entityId: row.id,
      field: "media",
      label: null,
    })),
    ...updateRows.map((row) => ({
      entityType: "construction_update",
      entityId: row.id,
      field: "media",
      label: row.slug,
    })),
    ...seoRows.map((row) => ({
      entityType: "seo_override",
      entityId: row.id,
      field: "ogImage",
      label: row.path,
    })),
    ...sectionRows.flatMap((row) =>
      jsonPaths(row.content, id).map((field) => ({
        entityType: "home_section",
        entityId: row.id,
        field,
        label: row.key,
      })),
    ),
    ...settingRows.flatMap((row) =>
      jsonPaths(row.value, id).map((field) => ({
        entityType: "settings",
        entityId: row.key,
        field,
        label: row.key,
      })),
    ),
    ...videoRows.map((row) => ({
      entityType: "media",
      entityId: row.id,
      field: "poster",
      label: row.name,
    })),
    ...rows.map((row) => ({ ...row, label: null })),
    ...viewRows.map((row) => ({
      entityType: "selector_view",
      entityId: row.id,
      field: row.block ? "facade" : "site",
      label: row.block,
    })),
  ];
}

/** The dotted paths of every string in `value` equal to `needle`, e.g. `items.2.mediaId`. */
export function jsonPaths(value: unknown, needle: string, prefix = ""): string[] {
  if (value === needle) return [prefix];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => jsonPaths(item, needle, join(prefix, String(index))));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      jsonPaths(item, needle, join(prefix, key)),
    );
  }
  return [];
}

const join = (prefix: string, key: string) => (prefix ? `${prefix}.${key}` : key);
