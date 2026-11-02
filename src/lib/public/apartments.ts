import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  max,
  min,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import type { Executor } from "@/db/client";
import {
  apartments,
  blocks,
  buildings,
  floors,
  layoutTypes,
  media,
  mediaUsages,
  settings,
} from "@/db/schema";
import { localize, type Localized, type Translatable } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { offsetOf, toPage, type Page } from "@/shared/api";
import {
  publicApartmentStatuses,
  withPriceVisibility,
  type ApartmentListQuery,
  type PublicApartment,
  type PublicApartmentDetail,
  type PublicApartmentStatus,
  type PublicLayoutType,
} from "@/shared/apartments";
import { settingsSchemas } from "@/shared/settings";

import { toPublicImage, type PublicImage } from "./media";

const columns = {
  slug: apartments.slug,
  number: apartments.number,
  status: apartments.status,
  areaTotal: apartments.areaTotal,
  priceMinor: apartments.priceMinor,
  currency: apartments.currency,
  floor: floors.number,
  blockCode: blocks.code,
  blockName: blocks.name,
  layoutSlug: layoutTypes.slug,
  layoutCode: layoutTypes.code,
  rooms: layoutTypes.rooms,
  planMediaId: layoutTypes.planMediaId,
};

type Row = {
  slug: string;
  number: string;
  status: string;
  areaTotal: string;
  priceMinor: number | null;
  currency: string;
  floor: number;
  blockCode: string;
  blockName: Translatable;
  layoutSlug: string;
  layoutCode: string;
  rooms: number;
  planMediaId: string | null;
};

/** Block, then floor, then the door number in numeric order. */
function naturalOrder(direction: typeof asc) {
  return [
    direction(blocks.sortOrder),
    direction(blocks.code),
    direction(floors.number),
    direction(sql`length(${apartments.number})`),
    direction(apartments.number),
  ];
}

const sortColumns = {
  number: null,
  area: apartments.areaTotal,
  floor: floors.number,
  price: apartments.priceMinor,
} as const;

/** One sort key; apartments without a price come last either way. */
function orderBy(query: ApartmentListQuery): SQL[] {
  const direction = query.sort.direction === "desc" ? desc : asc;
  const column = sortColumns[query.sort.field];
  if (!column) return naturalOrder(direction);
  const first =
    query.sort.field === "price"
      ? sql`${column} ${sql.raw(query.sort.direction)} nulls last`
      : direction(column);
  return [first, ...naturalOrder(asc)];
}

function filters(query: ApartmentListQuery): SQL | undefined {
  const statuses = query.status.length ? query.status : [...publicApartmentStatuses];
  const codes = query.block.map((code) => code.toUpperCase());
  return and(
    inArray(apartments.status, statuses),
    query.rooms.length ? inArray(layoutTypes.rooms, query.rooms) : undefined,
    codes.length ? inArray(blocks.code, codes) : undefined,
    query.areaMin !== undefined ? gte(apartments.areaTotal, String(query.areaMin)) : undefined,
    query.areaMax !== undefined ? lte(apartments.areaTotal, String(query.areaMax)) : undefined,
    query.floorMin !== undefined ? gte(floors.number, query.floorMin) : undefined,
    query.floorMax !== undefined ? lte(floors.number, query.floorMax) : undefined,
    query.priceMin !== undefined ? gte(apartments.priceMinor, query.priceMin) : undefined,
    query.priceMax !== undefined ? lte(apartments.priceMinor, query.priceMax) : undefined,
  );
}

/**
 * The catalogue: one page of the public apartments matching the filters.
 * A price filter or price sort counts only while prices are public.
 */
export async function listPublicApartments(
  requested: ApartmentListQuery,
): Promise<Page<PublicApartment>> {
  "use cache";
  cacheTag(publicTags.inventory, publicTags.settings, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const pricesVisible = await arePricesVisible(db);
  const query = withPriceVisibility(requested, pricesVisible);
  const where = filters(query);

  const [rows, [totals]] = await Promise.all([
    db
      .select(columns)
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(where)
      .orderBy(...orderBy(query))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(where),
  ]);

  const images = await planImages(db, rows, query.locale);
  const items = rows.map((row) => toPublicApartment(row, query.locale, pricesVisible, images));
  return toPage(items, totals?.total ?? 0, query);
}

/** One apartment for its page, or `null` when there is none to show. */
export async function getPublicApartment(
  slug: string,
  locale: Locale,
): Promise<PublicApartmentDetail | null> {
  "use cache";
  cacheTag(publicTags.inventory, publicTags.settings, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [[row], pricesVisible] = await Promise.all([
    db
      .select({
        ...columns,
        layoutId: layoutTypes.id,
        buildingSlug: buildings.slug,
        buildingName: buildings.name,
        roomAreas: layoutTypes.roomAreas,
        description: layoutTypes.description,
      })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .innerJoin(buildings, eq(buildings.id, blocks.buildingId))
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(
        and(eq(apartments.slug, slug), inArray(apartments.status, [...publicApartmentStatuses])),
      ),
    arePricesVisible(db),
  ]);
  if (!row) return null;

  const [images, gallery] = await Promise.all([
    planImages(db, [row], locale),
    layoutGallery(db, row.layoutId, locale),
  ]);
  return {
    ...toPublicApartment(row, locale, pricesVisible, images),
    building: { slug: row.buildingSlug, name: localize(row.buildingName, locale) },
    roomAreas: row.roomAreas,
    description: row.description ? localize(row.description, locale) : null,
    gallery,
  };
}

/**
 * A layout's gallery: images the library links to the layout type through
 * `media_usages` (`entity_type = 'layout_types'`, `field = 'gallery'`), in
 * the order they were added. Empty until the owner adds interior photos.
 */
async function layoutGallery(
  db: Executor,
  layoutId: string,
  locale: Locale,
): Promise<PublicImage[]> {
  const rows = await db
    .select({ file: media })
    .from(mediaUsages)
    .innerJoin(media, eq(media.id, mediaUsages.mediaId))
    .where(
      and(
        eq(mediaUsages.entityType, "layout_types"),
        eq(mediaUsages.entityId, layoutId),
        eq(mediaUsages.field, "gallery"),
      ),
    )
    .orderBy(asc(mediaUsages.createdAt), asc(media.id));
  return rows.flatMap(({ file }) => {
    const image = toPublicImage(file, locale);
    return image ? [image] : [];
  });
}

/**
 * Up to `limit` available apartments with the same number of rooms, nearest
 * in area first: the apartment page's "similar apartments".
 */
export async function listSimilarApartments(
  apartment: { slug: string; rooms: number; areaTotal: string },
  locale: Locale,
  limit = 4,
): Promise<PublicApartment[]> {
  "use cache";
  cacheTag(publicTags.inventory, publicTags.settings, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [rows, pricesVisible] = await Promise.all([
    db
      .select(columns)
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(
        and(
          eq(apartments.status, "available"),
          eq(layoutTypes.rooms, apartment.rooms),
          ne(apartments.slug, apartment.slug),
        ),
      )
      .orderBy(
        sql`abs(${apartments.areaTotal} - ${apartment.areaTotal}::numeric)`,
        ...naturalOrder(asc),
      )
      .limit(limit),
    arePricesVisible(db),
  ]);
  const images = await planImages(db, rows, locale);
  return rows.map((row) => toPublicApartment(row, locale, pricesVisible, images));
}

/** What the catalogue's filters can offer: the values public apartments have. */
export type CatalogueFacets = {
  rooms: number[];
  blocks: Array<{ code: string; name: Localized }>;
  floors: number[];
  area: { min: number; max: number } | null;
  /** Whole manat; null while prices are hidden or none is set. */
  price: { min: number; max: number } | null;
  pricesVisible: boolean;
};

export async function getCatalogueFacets(locale: Locale): Promise<CatalogueFacets> {
  "use cache";
  cacheTag(publicTags.inventory, publicTags.settings);
  cacheLife("days");

  const db = getDb();
  const listed = inArray(apartments.status, [...publicApartmentStatuses]);
  const [rooms, blockRows, floorRows, [ranges], pricesVisible] = await Promise.all([
    db
      .selectDistinct({ rooms: layoutTypes.rooms })
      .from(apartments)
      .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
      .where(listed)
      .orderBy(asc(layoutTypes.rooms)),
    db
      .selectDistinct({ code: blocks.code, name: blocks.name, sortOrder: blocks.sortOrder })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .where(listed)
      .orderBy(asc(blocks.sortOrder), asc(blocks.code)),
    db
      .selectDistinct({ number: floors.number })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .where(listed)
      .orderBy(asc(floors.number)),
    db
      .select({
        areaMin: min(apartments.areaTotal),
        areaMax: max(apartments.areaTotal),
        priceMin: min(apartments.priceMinor),
        priceMax: max(apartments.priceMinor),
      })
      .from(apartments)
      .where(listed),
    arePricesVisible(db),
  ]);

  return {
    rooms: rooms.map((row) => row.rooms),
    blocks: blockRows.map((row) => ({ code: row.code, name: localize(row.name, locale) })),
    floors: floorRows.map((row) => row.number),
    area:
      ranges?.areaMin != null && ranges.areaMax != null
        ? { min: Number(ranges.areaMin), max: Number(ranges.areaMax) }
        : null,
    price:
      pricesVisible && ranges?.priceMin != null && ranges.priceMax != null
        ? {
            min: Math.floor(Number(ranges.priceMin) / 100),
            max: Math.ceil(Number(ranges.priceMax) / 100),
          }
        : null,
    pricesVisible,
  };
}

/** Every layout type, with how many of its apartments are available. */
export async function listPublicLayoutTypes(locale: Locale): Promise<PublicLayoutType[]> {
  "use cache";
  cacheTag(publicTags.inventory, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const available = db
    .select({ layoutTypeId: apartments.layoutTypeId, count: count().as("count") })
    .from(apartments)
    .where(eq(apartments.status, "available"))
    .groupBy(apartments.layoutTypeId)
    .as("available");

  const rows = await db
    .select({ layout: layoutTypes, available: available.count })
    .from(layoutTypes)
    .leftJoin(available, eq(available.layoutTypeId, layoutTypes.id))
    .orderBy(asc(layoutTypes.sortOrder), asc(layoutTypes.rooms), asc(layoutTypes.areaTotal));

  const images = await planImages(
    db,
    rows.map((row) => row.layout),
    locale,
  );
  return rows.map(({ layout, available }) => ({
    slug: layout.slug,
    code: layout.code,
    rooms: layout.rooms,
    areaTotal: layout.areaTotal,
    roomAreas: layout.roomAreas,
    description: layout.description ? localize(layout.description, locale) : null,
    plan: layout.planMediaId ? (images.get(layout.planMediaId) ?? null) : null,
    available: Number(available ?? 0),
  }));
}

/** Whether the owner has made prices public (#7); hidden until they say so. */
async function arePricesVisible(db: Executor): Promise<boolean> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "prices"));
  return settingsSchemas.prices.safeParse(row?.value).data?.visible ?? false;
}

async function planImages(
  db: Executor,
  rows: Array<{ planMediaId: string | null }>,
  locale: Locale,
): Promise<Map<string, PublicImage | null>> {
  const ids = [...new Set(rows.flatMap((row) => (row.planMediaId ? [row.planMediaId] : [])))];
  if (!ids.length) return new Map();
  const files = await db.select().from(media).where(inArray(media.id, ids));
  return new Map(files.map((file) => [file.id, toPublicImage(file, locale)]));
}

function toPublicApartment(
  row: Row,
  locale: Locale,
  pricesVisible: boolean,
  images: Map<string, PublicImage | null>,
): PublicApartment {
  return {
    slug: row.slug,
    number: row.number,
    // The queries above only select public statuses.
    status: row.status as PublicApartmentStatus,
    rooms: row.rooms,
    areaTotal: row.areaTotal,
    floor: row.floor,
    block: { code: row.blockCode, name: localize(row.blockName, locale) },
    layout: { slug: row.layoutSlug, code: row.layoutCode },
    price:
      pricesVisible && row.priceMinor !== null
        ? { amount: String(row.priceMinor), currency: row.currency }
        : null,
    plan: row.planMediaId ? (images.get(row.planMediaId) ?? null) : null,
  };
}
