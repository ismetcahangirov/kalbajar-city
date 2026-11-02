import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { apartments, blocks, floors, layoutTypes } from "@/db/schema";
import { forbiddenError, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { offsetOf, toPage, type Page } from "@/shared/api";
import type {
  AdminApartment,
  ApartmentUpdate,
  adminApartmentListQuerySchema,
} from "@/shared/apartments";
import type { z } from "zod";

type ListQuery = z.output<typeof adminApartmentListQuerySchema>;

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
  floor: floors.number,
  block: blocks.code,
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
    floor: row.floor,
    block: row.block,
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

/** The console's apartment list, every status included. */
export async function listAdminApartments(
  db: Executor,
  query: ListQuery,
): Promise<Page<AdminApartment>> {
  const where: SQL | undefined = and(
    query.status.length ? inArray(apartments.status, query.status) : undefined,
    query.block.length
      ? inArray(
          blocks.code,
          query.block.map((code) => code.toUpperCase()),
        )
      : undefined,
    query.rooms.length ? inArray(layoutTypes.rooms, query.rooms) : undefined,
    query.q ? ilike(apartments.number, `%${query.q.replace(/[\\%_]/g, "\\$&")}%`) : undefined,
  );
  const direction = query.sort.direction === "desc" ? desc : asc;
  const column = sortColumns[query.sort.field];
  const order = column ? [direction(column), ...naturalOrder(asc)] : naturalOrder(direction);

  const [rows, [totals]] = await Promise.all([
    select(db, columns)
      .where(where)
      .orderBy(...order)
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

/**
 * Changes an apartment's status or price, audited in the same transaction,
 * then revalidates the public pages that show it. Sales may change the status
 * but not the price.
 */
export async function updateApartment(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: { id: string; input: ApartmentUpdate; user: SessionUser; headers: Headers },
): Promise<AdminApartment> {
  if (input.priceMinor !== undefined && !can(user.role, { inventory: ["update"] })) {
    throw forbiddenError();
  }

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(apartments).where(eq(apartments.id, id)).for("update");
    if (!before) throw notFound("No such apartment.");

    const [after] = await tx
      .update(apartments)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priceMinor !== undefined
          ? { priceMinor: input.priceMinor === null ? null : Number(input.priceMinor) }
          : {}),
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

/** The block codes and room counts the console's filters offer, in display order. */
export async function apartmentFilterOptions(
  db: Executor,
): Promise<{ blocks: string[]; rooms: number[] }> {
  const [blockRows, roomRows] = await Promise.all([
    db.select({ code: blocks.code }).from(blocks).orderBy(asc(blocks.sortOrder), asc(blocks.code)),
    db
      .selectDistinct({ rooms: layoutTypes.rooms })
      .from(layoutTypes)
      .orderBy(asc(layoutTypes.rooms)),
  ]);
  return { blocks: blockRows.map((row) => row.code), rooms: roomRows.map((row) => row.rooms) };
}
