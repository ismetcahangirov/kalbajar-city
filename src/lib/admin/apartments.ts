import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { apartments, blocks, floors, layoutTypes } from "@/db/schema";
import { forbiddenError, invalidField, notFound } from "@/lib/api/errors";
import { audit, auditMany } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { slugify } from "@/lib/slug";
import { offsetOf, toPage, type Page } from "@/shared/api";
import {
  applyBulkChange,
  changesPrice,
  salesApartmentFields,
  type AdminApartment,
  type ApartmentBulkResult,
  type adminApartmentListQuerySchema,
  type apartmentBulkSchema,
  type apartmentCreateSchema,
  type apartmentUpdateSchema,
} from "@/shared/apartments";
import { inventoryCsv, inventoryTemplate } from "@/shared/inventory-csv";

import { freeSlug, listFloors, listLayoutTypes } from "./inventory";

type ListQuery = z.output<typeof adminApartmentListQuerySchema>;

type Write = { user: SessionUser; headers: Headers };

const columns = {
  id: apartments.id,
  slug: apartments.slug,
  number: apartments.number,
  status: apartments.status,
  areaTotal: apartments.areaTotal,
  priceMinor: apartments.priceMinor,
  currency: apartments.currency,
  isDemo: apartments.isDemo,
  updatedAt: apartments.updatedAt,
  floorId: apartments.floorId,
  floor: floors.number,
  block: blocks.code,
  layoutTypeId: apartments.layoutTypeId,
  layoutCode: layoutTypes.code,
  rooms: layoutTypes.rooms,
};

function select(db: Executor, fields: typeof columns) {
  return db
    .select(fields)
    .from(apartments)
    .innerJoin(floors, eq(floors.id, apartments.floorId))
    .innerJoin(blocks, eq(blocks.id, floors.blockId))
    .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId));
}

type Row = Awaited<ReturnType<typeof select>>[number];

function toAdminApartment(row: Row): AdminApartment {
  return {
    id: row.id,
    slug: row.slug,
    number: row.number,
    status: row.status,
    areaTotal: row.areaTotal,
    priceMinor: row.priceMinor === null ? null : String(row.priceMinor),
    currency: row.currency,
    isDemo: row.isDemo,
    floorId: row.floorId,
    floor: row.floor,
    block: row.block,
    layoutTypeId: row.layoutTypeId,
    layout: { code: row.layoutCode, rooms: row.rooms },
    updatedAt: row.updatedAt.toISOString(),
  };
}

const naturalOrder = (direction: typeof asc) => [
  direction(blocks.sortOrder),
  direction(blocks.code),
  direction(floors.number),
  direction(sql`length(${apartments.number})`),
  direction(apartments.number),
];

const sortColumns = {
  number: null,
  area: apartments.areaTotal,
  floor: floors.number,
  price: apartments.priceMinor,
  updatedAt: apartments.updatedAt,
} as const;

/** The list's filters and order; the CSV export takes the same. */
export type ApartmentFilters = Omit<ListQuery, "page" | "pageSize">;

function whereOf(query: ApartmentFilters): SQL | undefined {
  return and(
    query.status.length ? inArray(apartments.status, query.status) : undefined,
    query.block.length
      ? inArray(
          blocks.code,
          query.block.map((code) => code.toUpperCase()),
        )
      : undefined,
    query.rooms.length ? inArray(layoutTypes.rooms, query.rooms) : undefined,
    query.floor.length ? inArray(floors.number, query.floor) : undefined,
    query.q ? ilike(apartments.number, `%${query.q.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
  );
}

function orderOf(query: ApartmentFilters) {
  const direction = query.sort.direction === "desc" ? desc : asc;
  const column = sortColumns[query.sort.field];
  return column ? [direction(column), ...naturalOrder(asc)] : naturalOrder(direction);
}

/** The console's apartment list, every status included. */
export async function listAdminApartments(
  db: Executor,
  query: ListQuery,
): Promise<Page<AdminApartment>> {
  const where = whereOf(query);
  const [rows, [totals]] = await Promise.all([
    select(db, columns)
      .where(where)
      .orderBy(...orderOf(query))
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
  return toPage(rows.map(toAdminApartment), totals?.total ?? 0, query);
}

export async function getAdminApartment(db: Executor, id: string): Promise<AdminApartment> {
  const [row] = await select(db, columns).where(eq(apartments.id, id));
  if (!row) throw notFound("No such apartment.");
  return toAdminApartment(row);
}

/** The block code of a floor, refusing a floor that does not exist. */
async function blockOfFloor(db: Executor, floorId: string): Promise<string> {
  const [row] = await db
    .select({ code: blocks.code })
    .from(floors)
    .innerJoin(blocks, eq(blocks.id, floors.blockId))
    .where(eq(floors.id, floorId));
  if (!row) throw invalidField("floorId", "No such floor.");
  return row.code;
}

async function assertLayout(db: Executor, id: string): Promise<void> {
  const [row] = await db
    .select({ id: layoutTypes.id })
    .from(layoutTypes)
    .where(eq(layoutTypes.id, id));
  if (!row) throw invalidField("layoutTypeId", "No such layout type.");
}

/** A floor holds each number once (`apartments_floor_number`); say so on the field. */
async function assertNumberFree(
  db: Executor,
  floorId: string,
  number: string,
  id?: string,
): Promise<void> {
  const same = and(eq(apartments.floorId, floorId), eq(apartments.number, number));
  const [taken] = await db
    .select({ id: apartments.id })
    .from(apartments)
    .where(id ? and(same, ne(apartments.id, id)) : same);
  if (taken) throw invalidField("number", "The floor already has an apartment with this number.");
}

/** A new apartment; its slug is made from the block and the number and kept from then on. */
export async function createApartment(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof apartmentCreateSchema> },
): Promise<AdminApartment> {
  const result = await db.transaction(async (tx) => {
    const block = await blockOfFloor(tx, input.floorId);
    await assertLayout(tx, input.layoutTypeId);
    await assertNumberFree(tx, input.floorId, input.number);
    const slug = await freeSlug(
      tx,
      apartments,
      slugify(`blok ${block} menzil ${input.number}`),
      "menzil",
    );
    const [row] = await tx
      .insert(apartments)
      .values({
        ...input,
        slug,
        priceMinor: input.priceMinor === null ? null : Number(input.priceMinor),
      })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "apartment.create",
      entityType: "apartment",
      entityId: row!.id,
      after: row,
      headers,
    });
    return getAdminApartment(tx, row!.id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

/**
 * Changes an apartment, audited in the same transaction, then revalidates
 * the public pages that show it. Sales may change the status and nothing
 * else.
 */
export async function updateApartment(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: Write & { id: string; input: z.output<typeof apartmentUpdateSchema> },
): Promise<AdminApartment> {
  const restricted = Object.keys(input).some((key) => !salesApartmentFields.has(key));
  if (restricted && !can(user.role, { inventory: ["update"] })) throw forbiddenError();

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(apartments).where(eq(apartments.id, id)).for("update");
    if (!before) throw notFound("No such apartment.");
    if (input.floorId) await blockOfFloor(tx, input.floorId);
    if (input.layoutTypeId) await assertLayout(tx, input.layoutTypeId);
    if (input.floorId || input.number) {
      await assertNumberFree(
        tx,
        input.floorId ?? before.floorId,
        input.number ?? before.number,
        id,
      );
    }

    const { priceMinor, ...rest } = input;
    const [after] = await tx
      .update(apartments)
      .set({
        ...rest,
        ...(priceMinor !== undefined
          ? { priceMinor: priceMinor === null ? null : Number(priceMinor) }
          : {}),
        // A hotspot drawn on the old floor's plan does not belong to the new one.
        ...(input.floorId && input.floorId !== before.floorId ? { planPolygon: null } : {}),
      })
      .where(eq(apartments.id, id))
      .returning();

    await audit(tx, {
      actorId: user.id,
      action: "apartment.update",
      entityType: "apartment",
      entityId: id,
      before,
      after,
      headers,
    });
    return getAdminApartment(tx, id);
  });

  revalidatePublic(publicTags.inventory);
  return result;
}

/**
 * Removes an apartment. Leads that came from it keep their details and lose
 * the link (`set null`), so nothing depends on it.
 */
export async function deleteApartment(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(apartments).where(eq(apartments.id, id)).for("update");
    if (!before) throw notFound("No such apartment.");
    await tx.delete(apartments).where(eq(apartments.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "apartment.delete",
      entityType: "apartment",
      entityId: id,
      before,
      after: null,
      headers,
    });
  });
  revalidatePublic(publicTags.inventory);
}

/**
 * One change to many apartments, in one transaction, with an audit entry per
 * apartment that changed. Sales may change statuses (publishing included)
 * but not prices.
 */
export async function bulkUpdateApartments(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof apartmentBulkSchema> },
): Promise<ApartmentBulkResult> {
  if (changesPrice(input.change) && !can(user.role, { inventory: ["update"] })) {
    throw forbiddenError();
  }

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(apartments)
      .where(inArray(apartments.id, input.ids))
      .orderBy(asc(apartments.id))
      .for("update");
    if (rows.length !== input.ids.length) {
      const found = new Set(rows.map((row) => row.id));
      const missing = input.ids.filter((id) => !found.has(id));
      throw invalidField("ids", `No such apartments: ${missing.join(", ")}.`);
    }

    const entries = [];
    for (const before of rows) {
      const current = {
        status: before.status,
        priceMinor: before.priceMinor === null ? null : String(before.priceMinor),
      };
      const next = applyBulkChange(current, input.change);
      if (next.status === current.status && next.priceMinor === current.priceMinor) continue;
      const [after] = await tx
        .update(apartments)
        .set({
          status: next.status,
          priceMinor: next.priceMinor === null ? null : Number(next.priceMinor),
        })
        .where(eq(apartments.id, before.id))
        .returning();
      entries.push({
        actorId: user.id,
        action: "apartment.update",
        entityType: "apartment",
        entityId: before.id,
        before,
        after,
        headers,
      });
    }
    await auditMany(tx, entries);
    return { updated: entries.length, unchanged: rows.length - entries.length };
  });

  if (result.updated) revalidatePublic(publicTags.inventory);
  return result;
}

/** The apartments the filters match, every page, as the CSV the importer reads back. */
export async function exportApartmentsCsv(db: Executor, query: ApartmentFilters): Promise<string> {
  const rows = await select(db, columns)
    .where(whereOf(query))
    .orderBy(...orderOf(query));
  return inventoryCsv(
    rows.map((row) => ({
      block: row.block,
      floor: row.floor,
      number: row.number,
      layout: row.layoutCode,
      areaTotal: row.areaTotal,
      status: row.status,
      priceMinor: row.priceMinor === null ? null : String(row.priceMinor),
    })),
  );
}

/**
 * The import template: the header and one example row, using a block and a
 * layout that exist, so the example reads as valid. Its price is left empty,
 * so importing the example unchanged never sets a price.
 */
export async function apartmentsCsvTemplate(db: Executor): Promise<string> {
  const [[block], [layout]] = await Promise.all([
    db.select({ code: blocks.code }).from(blocks).orderBy(asc(blocks.sortOrder)).limit(1),
    db
      .select({ code: layoutTypes.code, areaTotal: layoutTypes.areaTotal })
      .from(layoutTypes)
      .orderBy(asc(layoutTypes.sortOrder))
      .limit(1),
  ]);
  return inventoryTemplate({
    block: block?.code ?? "A",
    floor: 1,
    number: "101",
    layout: layout?.code ?? "3-111",
    areaTotal: layout?.areaTotal ?? "111.15",
    status: "available",
    priceMinor: null,
  });
}

/** A CSV download; `filename` is ASCII. */
export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** The block codes, floor numbers and room counts the console's filters offer, in order. */
export async function apartmentFilterOptions(
  db: Executor,
): Promise<{ blocks: string[]; floors: number[]; rooms: number[] }> {
  const [blockRows, floorRows, roomRows] = await Promise.all([
    db.select({ code: blocks.code }).from(blocks).orderBy(asc(blocks.sortOrder), asc(blocks.code)),
    db.selectDistinct({ number: floors.number }).from(floors).orderBy(asc(floors.number)),
    db
      .selectDistinct({ rooms: layoutTypes.rooms })
      .from(layoutTypes)
      .orderBy(asc(layoutTypes.rooms)),
  ]);
  return {
    blocks: blockRows.map((row) => row.code),
    floors: floorRows.map((row) => row.number),
    rooms: roomRows.map((row) => row.rooms),
  };
}

/** What the apartment form offers: every floor by block, and every layout. */
export async function apartmentFormOptions(db: Executor) {
  const [floorRows, layoutRows] = await Promise.all([listFloors(db), listLayoutTypes(db)]);
  return {
    floors: floorRows.map((floor) => ({
      id: floor.id,
      block: floor.blockCode,
      number: floor.number,
    })),
    layouts: layoutRows.map((layout) => ({
      id: layout.id,
      code: layout.code,
      rooms: layout.rooms,
      areaTotal: layout.areaTotal,
    })),
  };
}
