import { sql } from "drizzle-orm";
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
  uuid,
} from "drizzle-orm/pg-core";

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
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [index("blocks_building_idx").on(t.buildingId)],
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
    isDemo: isDemo(),
    ...timestamps,
  },
  (t) => [unique("floors_block_number").on(t.blockId, t.number)],
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
  ],
);
