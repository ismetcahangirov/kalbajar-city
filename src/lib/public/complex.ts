import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import {
  apartments,
  blocks,
  buildings,
  floors,
  layoutTypes,
  media,
  selectorViews,
} from "@/db/schema";
import { localize } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { publicApartmentStatuses, type PublicApartmentStatus } from "@/shared/apartments";
import type { ComplexSelectorData, SelectorBlock, SelectorPicture } from "@/shared/complex";

import { toPublicImage } from "./media";

/**
 * Every public apartment, grouped by block and floor, for the complex
 * selector. One query: the demo set is 143 apartments and the real
 * inventory is of the same order, so the page carries all of it and every
 * selection is a lookup. The pictures the console drew hotspots on come with
 * it: the site render, each block's facade and each floor's plan.
 */
export async function getComplexSelector(locale: Locale): Promise<ComplexSelectorData> {
  "use cache";
  cacheTag(publicTags.inventory, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [rows, views] = await Promise.all([
    db
      .select({
        blockId: blocks.id,
        blockCode: blocks.code,
        blockName: blocks.name,
        buildingSlug: buildings.slug,
        buildingName: buildings.name,
        floor: floors.number,
        slug: apartments.slug,
        number: apartments.number,
        status: apartments.status,
        rooms: layoutTypes.rooms,
        areaTotal: apartments.areaTotal,
        planPolygon: apartments.planPolygon,
        floorPlanId: floors.planMediaId,
        facadePolygon: floors.facadePolygon,
        sitePolygon: blocks.sitePolygon,
      })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .innerJoin(buildings, eq(buildings.id, blocks.buildingId))
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(inArray(apartments.status, [...publicApartmentStatuses]))
      .orderBy(
        asc(buildings.sortOrder),
        asc(blocks.sortOrder),
        asc(blocks.code),
        asc(floors.number),
        asc(sql`length(${apartments.number})`),
        asc(apartments.number),
      ),
    db
      .select({ blockId: selectorViews.blockId, mediaId: selectorViews.mediaId })
      .from(selectorViews),
  ]);

  const facadeIds = new Map<string, string>();
  let siteId: string | null = null;
  for (const view of views) {
    if (view.blockId) facadeIds.set(view.blockId, view.mediaId);
    else siteId = view.mediaId;
  }
  const wanted = [
    ...new Set([
      ...views.map((view) => view.mediaId),
      ...rows.flatMap((row) => (row.floorPlanId ? [row.floorPlanId] : [])),
    ]),
  ];
  const files = wanted.length ? await db.select().from(media).where(inArray(media.id, wanted)) : [];
  const pictures = new Map<string, SelectorPicture>();
  for (const file of files) {
    const image = toPublicImage(file, locale);
    if (image) {
      pictures.set(file.id, {
        src: image.src,
        width: image.width,
        height: image.height,
        alt: image.alt,
        illustrative: image.illustrative,
      });
    }
  }
  const picture = (id: string | null | undefined) => (id ? (pictures.get(id) ?? null) : null);

  const result: SelectorBlock[] = [];
  for (const row of rows) {
    let block = result.at(-1);
    if (block?.code !== row.blockCode) {
      block = {
        code: row.blockCode,
        name: localize(row.blockName, locale),
        building: { slug: row.buildingSlug, name: localize(row.buildingName, locale) },
        floors: [],
        sitePolygon: row.sitePolygon,
        facade: picture(facadeIds.get(row.blockId)),
      };
      result.push(block);
    }
    let floor = block.floors.at(-1);
    if (floor?.number !== row.floor) {
      floor = {
        number: row.floor,
        apartments: [],
        facadePolygon: row.facadePolygon,
        plan: picture(row.floorPlanId),
      };
      block.floors.push(floor);
    }
    floor.apartments.push({
      slug: row.slug,
      number: row.number,
      // The query selects public statuses only.
      status: row.status as PublicApartmentStatus,
      rooms: row.rooms,
      areaTotal: row.areaTotal,
      planPolygon: row.planPolygon,
    });
  }
  return { site: picture(siteId), blocks: result };
}
