import { sql, type SQLWrapper } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { Polygon } from "@/shared/complex";
import { apartmentStatuses, type RoomArea } from "@/shared/inventory";

import { area, id, slug, timestamps, translatable } from "./columns";
import { media } from "./media";

export const apartmentStatus = pgEnum("apartment_status", apartmentStatuses);

/**
 * `is_demo` marks rows the seed invented to stand in for the owner's
 * inventory (#7). The console flags them and the owner's import replaces them.
 */
const isDemo = () => boolean("is_demo").notNull().default(false);

const sortOrder = () => integer("sort_order").notNull().default(0);

/**
 * A hotspot of the complex selector (#19): a polygon in normalised
 * coordinates (0–1 on both axes) drawn in the console on the picture of the
 * level above: a block on the site render, a floor on its block's facade, an
 * apartment on its floor's plan. Null until drawn; `selectorPolygonSchema`
 * in `@/shared/complex` validates it on the way in.
 */
const selectorPolygon = (name: string) => jsonb(name).$type<Polygon>();

const polygonIsArray = (column: SQLWrapper) =>
  sql`${column} is null or jsonb_typeof(${column}) = 'array'`;

export const buildings = pgTable("buildings", {
  id: id(),
  slug: slug(),
  name: translatable("name").notNull(),
  sortOrder: sortOrder(),
  isDemo: isDemo(),
  ...timestamps,
});

export const blocks = pgTable(
  "blocks",
  {
    id: id(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "restrict" }),
    slug: slug(),
    /** Short label shown on plans and hotspots, e.g. `A`. */
    code: text("code").notNull().unique(),
    name: translatable("name").notNull(),
    sortOrder: sortOrder(),
    /** The block's hotspot on the site render (`selector_views` without a block). */
    sitePolygon: selectorPolygon("site_polygon"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [
    index("blocks_building_idx").on(t.buildingId),
    check("blocks_site_polygon_array", polygonIsArray(t.sitePolygon)),
  ],
);

export const floors = pgTable(
  "floors",
  {
    id: id(),
    blockId: uuid("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "restrict" }),
    /** 0 is the ground floor, negative numbers are below ground. */
    number: smallint("number").notNull(),
    planMediaId: uuid("plan_media_id").references(() => media.id, { onDelete: "restrict" }),
    /** The floor's hotspot on its block's facade render. */
    facadePolygon: selectorPolygon("facade_polygon"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [
    unique("floors_block_number").on(t.blockId, t.number),
    check("floors_facade_polygon_array", polygonIsArray(t.facadePolygon)),
  ],
);

export const layoutTypes = pgTable(
  "layout_types",
  {
    id: id(),
    slug: slug(),
    /** Short label used in the console and CSV, e.g. `3-111`. */
    code: text("code").notNull().unique(),
    rooms: smallint("rooms").notNull(),
    areaTotal: area("area_total").notNull(),
    /** Room-by-room breakdown as published on the plan. */
    roomAreas: jsonb("room_areas").$type<RoomArea[]>().notNull().default([]),
    planMediaId: uuid("plan_media_id").references(() => media.id, { onDelete: "restrict" }),
    description: translatable("description"),
    sortOrder: sortOrder(),
    ...timestamps,
  },
  (t) => [
    check("layout_types_rooms_range", sql`${t.rooms} between 1 and 10`),
    check("layout_types_area_positive", sql`${t.areaTotal} > 0`),
  ],
);

export const apartments = pgTable(
  "apartments",
  {
    id: id(),
    slug: slug(),
    /** The number on the door and in the sales documents. */
    number: text("number").notNull(),
    floorId: uuid("floor_id")
      .notNull()
      .references(() => floors.id, { onDelete: "restrict" }),
    layoutTypeId: uuid("layout_type_id")
      .notNull()
      .references(() => layoutTypes.id, { onDelete: "restrict" }),
    status: apartmentStatus("status").notNull().default("available"),
    /** Measured area; may differ slightly from the layout type's. */
    areaTotal: area("area_total").notNull(),
    /** In the currency's minor unit (qəpik for AZN). Null until the owner sets it. */
    priceMinor: bigint("price_minor", { mode: "number" }),
    currency: char("currency", { length: 3 }).notNull().default("AZN"),
    /** The apartment's hotspot on its floor's plan. */
    planPolygon: selectorPolygon("plan_polygon"),
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [
    unique("apartments_floor_number").on(t.floorId, t.number),
    index("apartments_status_idx").on(t.status),
    index("apartments_layout_type_idx").on(t.layoutTypeId),
    check("apartments_area_positive", sql`${t.areaTotal} > 0`),
    check("apartments_price_non_negative", sql`${t.priceMinor} >= 0`),
    check("apartments_currency_code", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("apartments_plan_polygon_array", polygonIsArray(t.planPolygon)),
  ],
);

/**
 * The pictures the complex selector draws its hotspots on (#19): the site
 * render (no block, at most one row) and each block's facade render. A
 * floor's picture is its plan, `floors.plan_media_id`.
 */
export const selectorViews = pgTable(
  "selector_views",
  {
    id: id(),
    blockId: uuid("block_id")
      .unique("selector_views_block")
      .references(() => blocks.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("selector_views_site")
      .on(sql`(${t.blockId} is null)`)
      .where(sql`${t.blockId} is null`),
    index("selector_views_media_idx").on(t.mediaId),
  ],
);
