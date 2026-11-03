import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { apartments, blocks, buildings, floors, layoutTypes } from "@/db/schema";
import { localize } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { publicApartmentStatuses, type PublicApartmentStatus } from "@/shared/apartments";
import type { ComplexSelectorData, SelectorBlock } from "@/shared/complex";

/**
 * Every public apartment, grouped by block and floor, for the complex
 * selector. One query: the demo set is 143 apartments and the real
 * inventory is of the same order, so the page carries all of it and every
 * selection is a lookup.
 */
export async function getComplexSelector(locale: Locale): Promise<ComplexSelectorData> {
  "use cache";
  cacheTag(publicTags.inventory);
  cacheLife("days");

  const rows = await getDb()
    .select({
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
    );

  const result: SelectorBlock[] = [];
  for (const row of rows) {
    let block = result.at(-1);
    if (block?.code !== row.blockCode) {
      block = {
        code: row.blockCode,
        name: localize(row.blockName, locale),
        building: { slug: row.buildingSlug, name: localize(row.buildingName, locale) },
        floors: [],
      };
      result.push(block);
    }
    let floor = block.floors.at(-1);
    if (floor?.number !== row.floor) {
      floor = { number: row.floor, apartments: [] };
      block.floors.push(floor);
    }
    floor.apartments.push({
      slug: row.slug,
      number: row.number,
      // The query selects public statuses only.
      status: row.status as PublicApartmentStatus,
      rooms: row.rooms,
      areaTotal: row.areaTotal,
    });
  }
  return { blocks: result };
}
