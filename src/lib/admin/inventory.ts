import "server-only";

import { and, asc, count, eq, inArray, like, ne } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { apartments, blocks, buildings, floors, layoutTypes, media } from "@/db/schema";
import { HttpError, invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  inUseCode,
  type AdminBlock,
  type AdminBuilding,
  type AdminFloor,
  type AdminLayoutType,
  type AdminPlan,
  type blockCreateSchema,
  type blockUpdateSchema,
  type buildingCreateSchema,
  type buildingUpdateSchema,
  type floorCreateSchema,
  type floorUpdateSchema,
  type layoutTypeCreateSchema,
  type layoutTypeUpdateSchema,
} from "@/shared/inventory";

import { assertMedia } from "./content";
import { toAdminMedia } from "./media";

/**
 * The inventory's structure (#24): buildings, blocks, floors and layout
 * types. Every write is audited in its transaction and revalidates the
 * public pages' `inventory` tag. Slugs are made once, from the Azerbaijani
 * name or code, and kept, so public links do not break when a name changes.
 */

type Write = { user: SessionUser; headers: Headers };

type SlugTable = typeof buildings | typeof blocks | typeof layoutTypes | typeof apartments;

/** `base`, or `base-2`, `base-3`, ... when another row has it. */
export async function freeSlug(
  db: Executor,
  table: SlugTable,
  base: string,
  fallback: string,
): Promise<string> {
  const slug = base || fallback;
  // slugify leaves only [a-z0-9-], so the pattern has no wildcards of its own.
  const taken = await db
    .select({ slug: table.slug })
    .from(table as typeof buildings)
    .where(like(table.slug, `${slug}%`));
  return uniqueSlug(slug, new Set(taken.map((row) => row.slug)));
}

/** 409 `IN_USE`: the entity still has rows that depend on it. */
function inUse(message: string, dependents: Record<string, number>): HttpError {
  return new HttpError(409, inUseCode, message, undefined, { dependents });
}

/** Plan previews by media id. */
async function plansOf(db: Executor, ids: Array<string | null>): Promise<Map<string, AdminPlan>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (!wanted.length) return new Map();
  const rows = await db.select().from(media).where(inArray(media.id, wanted));
  return new Map(
    rows.map((row) => {
      const item = toAdminMedia(row);
      return [row.id, { id: row.id, previewUrl: item.previewUrl, alt: row.alt?.az ?? null }];
    }),
  );
}

async function assertPlan(db: Executor, id: string | null | undefined): Promise<void> {
  if (id) await assertMedia(db, [id], ["image"], "planMediaId");
}

// Buildings

export async function listBuildings(db: Executor): Promise<AdminBuilding[]> {
  const rows = await db
    .select({ building: buildings, blocks: count(blocks.id) })
    .from(buildings)
    .leftJoin(blocks, eq(blocks.buildingId, buildings.id))
    .groupBy(buildings.id)
    .orderBy(asc(buildings.sortOrder), asc(buildings.slug));
  return rows.map(({ building, blocks: blockCount }) => ({
    id: building.id,
    slug: building.slug,
    name: building.name,
    sortOrder: building.sortOrder,
    isDemo: building.isDemo,
    blocks: blockCount,
  }));
}

async function getBuilding(db: Executor, id: string): Promise<AdminBuilding> {
  const item = (await listBuildings(db)).find((building) => building.id === id);
  if (!item) throw notFound("No such building.");
  return item;
}

export async function createBuilding(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof buildingCreateSchema> },
): Promise<AdminBuilding> {
  const result = await db.transaction(async (tx) => {
    const slug = await freeSlug(tx, buildings, slugify(input.name.az), "bina");
    const [row] = await tx
      .insert(buildings)
      .values({ ...input, slug })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "building.create",
      entityType: "building",
      entityId: row!.id,
      after: row,
      headers,
    });
    return getBuilding(tx, row!.id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function updateBuilding(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: Write & { id: string; input: z.output<typeof buildingUpdateSchema> },
): Promise<AdminBuilding> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(buildings).where(eq(buildings.id, id)).for("update");
    if (!before) throw notFound("No such building.");
    const [after] = await tx.update(buildings).set(input).where(eq(buildings.id, id)).returning();
    await audit(tx, {
      actorId: user.id,
      action: "building.update",
      entityType: "building",
      entityId: id,
      before,
      after,
      headers,
    });
    return getBuilding(tx, id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function deleteBuilding(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(buildings).where(eq(buildings.id, id)).for("update");
    if (!before) throw notFound("No such building.");
    const [used] = await tx.select({ n: count() }).from(blocks).where(eq(blocks.buildingId, id));
    if (used && used.n > 0) throw inUse("The building still has blocks.", { blocks: used.n });
    await tx.delete(buildings).where(eq(buildings.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "building.delete",
      entityType: "building",
      entityId: id,
      before,
      after: null,
      headers,
    });
  });
  revalidatePublic(publicTags.inventory);
}

// Blocks

export async function listBlocks(db: Executor): Promise<AdminBlock[]> {
  const [rows, floorCounts, apartmentCounts] = await Promise.all([
    db
      .select({ block: blocks })
      .from(blocks)
      .innerJoin(buildings, eq(buildings.id, blocks.buildingId))
      .orderBy(asc(buildings.sortOrder), asc(blocks.sortOrder), asc(blocks.code)),
    db.select({ blockId: floors.blockId, n: count() }).from(floors).groupBy(floors.blockId),
    db
      .select({ blockId: floors.blockId, n: count() })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .groupBy(floors.blockId),
  ]);
  const floorsBy = new Map(floorCounts.map((row) => [row.blockId, row.n]));
  const apartmentsBy = new Map(apartmentCounts.map((row) => [row.blockId, row.n]));
  return rows.map(({ block }) => ({
    id: block.id,
    slug: block.slug,
    buildingId: block.buildingId,
    code: block.code,
    name: block.name,
    sortOrder: block.sortOrder,
    isDemo: block.isDemo,
    floors: floorsBy.get(block.id) ?? 0,
    apartments: apartmentsBy.get(block.id) ?? 0,
  }));
}

async function getBlock(db: Executor, id: string): Promise<AdminBlock> {
  const item = (await listBlocks(db)).find((block) => block.id === id);
  if (!item) throw notFound("No such block.");
  return item;
}

async function assertBuilding(db: Executor, id: string | undefined): Promise<void> {
  if (!id) return;
  const [row] = await db.select({ id: buildings.id }).from(buildings).where(eq(buildings.id, id));
  if (!row) throw invalidField("buildingId", "No such building.");
}

async function assertBlockCodeFree(db: Executor, code: string, id?: string): Promise<void> {
  const same = eq(blocks.code, code);
  const [taken] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(id ? and(same, ne(blocks.id, id)) : same);
  if (taken) throw invalidField("code", "Another block has this code.");
}

export async function createBlock(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof blockCreateSchema> },
): Promise<AdminBlock> {
  const result = await db.transaction(async (tx) => {
    await assertBuilding(tx, input.buildingId);
    await assertBlockCodeFree(tx, input.code);
    const slug = await freeSlug(tx, blocks, slugify(`blok ${input.code}`), "blok");
    const [row] = await tx
      .insert(blocks)
      .values({ ...input, slug })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "block.create",
      entityType: "block",
      entityId: row!.id,
      after: row,
      headers,
    });
    return getBlock(tx, row!.id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function updateBlock(
  db: Executor,
  { id, input, user, headers }: Write & { id: string; input: z.output<typeof blockUpdateSchema> },
): Promise<AdminBlock> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(blocks).where(eq(blocks.id, id)).for("update");
    if (!before) throw notFound("No such block.");
    await assertBuilding(tx, input.buildingId);
    if (input.code) await assertBlockCodeFree(tx, input.code, id);
    const [after] = await tx.update(blocks).set(input).where(eq(blocks.id, id)).returning();
    await audit(tx, {
      actorId: user.id,
      action: "block.update",
      entityType: "block",
      entityId: id,
      before,
      after,
      headers,
    });
    return getBlock(tx, id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function deleteBlock(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(blocks).where(eq(blocks.id, id)).for("update");
    if (!before) throw notFound("No such block.");
    const [used] = await tx.select({ n: count() }).from(floors).where(eq(floors.blockId, id));
    if (used && used.n > 0) throw inUse("The block still has floors.", { floors: used.n });
    await tx.delete(blocks).where(eq(blocks.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "block.delete",
      entityType: "block",
      entityId: id,
      before,
      after: null,
      headers,
    });
  });
  revalidatePublic(publicTags.inventory);
}

// Floors

export async function listFloors(
  db: Executor,
  { block }: { block?: string } = {},
): Promise<AdminFloor[]> {
  const [rows, apartmentCounts] = await Promise.all([
    db
      .select({ floor: floors, blockCode: blocks.code })
      .from(floors)
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .where(block ? eq(floors.blockId, block) : undefined)
      .orderBy(asc(blocks.sortOrder), asc(blocks.code), asc(floors.number)),
    db
      .select({ floorId: apartments.floorId, n: count() })
      .from(apartments)
      .groupBy(apartments.floorId),
  ]);
  const apartmentsBy = new Map(apartmentCounts.map((row) => [row.floorId, row.n]));
  const plans = await plansOf(
    db,
    rows.map(({ floor }) => floor.planMediaId),
  );
  return rows.map(({ floor, blockCode }) => ({
    id: floor.id,
    blockId: floor.blockId,
    blockCode,
    number: floor.number,
    plan: floor.planMediaId ? (plans.get(floor.planMediaId) ?? null) : null,
    isDemo: floor.isDemo,
    apartments: apartmentsBy.get(floor.id) ?? 0,
  }));
}

async function getFloor(db: Executor, id: string): Promise<AdminFloor> {
  const [row] = await db.select({ blockId: floors.blockId }).from(floors).where(eq(floors.id, id));
  const item = row && (await listFloors(db, { block: row.blockId })).find((f) => f.id === id);
  if (!item) throw notFound("No such floor.");
  return item;
}

async function assertFloorFree(
  db: Executor,
  blockId: string,
  number: number,
  id?: string,
): Promise<void> {
  const same = and(eq(floors.blockId, blockId), eq(floors.number, number));
  const [taken] = await db
    .select({ id: floors.id })
    .from(floors)
    .where(id ? and(same, ne(floors.id, id)) : same);
  if (taken) throw invalidField("number", "The block already has this floor.");
}

export async function createFloor(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof floorCreateSchema> },
): Promise<AdminFloor> {
  const result = await db.transaction(async (tx) => {
    const [block] = await tx
      .select({ id: blocks.id })
      .from(blocks)
      .where(eq(blocks.id, input.blockId));
    if (!block) throw invalidField("blockId", "No such block.");
    await assertFloorFree(tx, input.blockId, input.number);
    await assertPlan(tx, input.planMediaId);
    const [row] = await tx.insert(floors).values(input).returning();
    await audit(tx, {
      actorId: user.id,
      action: "floor.create",
      entityType: "floor",
      entityId: row!.id,
      after: row,
      headers,
    });
    return getFloor(tx, row!.id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function updateFloor(
  db: Executor,
  { id, input, user, headers }: Write & { id: string; input: z.output<typeof floorUpdateSchema> },
): Promise<AdminFloor> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(floors).where(eq(floors.id, id)).for("update");
    if (!before) throw notFound("No such floor.");
    if (input.number !== undefined) await assertFloorFree(tx, before.blockId, input.number, id);
    await assertPlan(tx, input.planMediaId);
    const [after] = await tx.update(floors).set(input).where(eq(floors.id, id)).returning();
    await audit(tx, {
      actorId: user.id,
      action: "floor.update",
      entityType: "floor",
      entityId: id,
      before,
      after,
      headers,
    });
    return getFloor(tx, id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function deleteFloor(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(floors).where(eq(floors.id, id)).for("update");
    if (!before) throw notFound("No such floor.");
    const [used] = await tx
      .select({ n: count() })
      .from(apartments)
      .where(eq(apartments.floorId, id));
    if (used && used.n > 0) throw inUse("The floor still has apartments.", { apartments: used.n });
    await tx.delete(floors).where(eq(floors.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "floor.delete",
      entityType: "floor",
      entityId: id,
      before,
      after: null,
      headers,
    });
  });
  revalidatePublic(publicTags.inventory);
}

// Layout types

export async function listLayoutTypes(db: Executor): Promise<AdminLayoutType[]> {
  const [rows, apartmentCounts] = await Promise.all([
    db
      .select()
      .from(layoutTypes)
      .orderBy(asc(layoutTypes.sortOrder), asc(layoutTypes.rooms), asc(layoutTypes.code)),
    db
      .select({ layoutTypeId: apartments.layoutTypeId, n: count() })
      .from(apartments)
      .groupBy(apartments.layoutTypeId),
  ]);
  const apartmentsBy = new Map(apartmentCounts.map((row) => [row.layoutTypeId, row.n]));
  const plans = await plansOf(
    db,
    rows.map((row) => row.planMediaId),
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    code: row.code,
    rooms: row.rooms,
    areaTotal: row.areaTotal,
    roomAreas: row.roomAreas,
    plan: row.planMediaId ? (plans.get(row.planMediaId) ?? null) : null,
    description: row.description,
    sortOrder: row.sortOrder,
    apartments: apartmentsBy.get(row.id) ?? 0,
  }));
}

export async function getLayoutType(db: Executor, id: string): Promise<AdminLayoutType> {
  const item = (await listLayoutTypes(db)).find((layout) => layout.id === id);
  if (!item) throw notFound("No such layout type.");
  return item;
}

async function assertLayoutCodeFree(db: Executor, code: string, id?: string): Promise<void> {
  const same = eq(layoutTypes.code, code);
  const [taken] = await db
    .select({ id: layoutTypes.id })
    .from(layoutTypes)
    .where(id ? and(same, ne(layoutTypes.id, id)) : same);
  if (taken) throw invalidField("code", "Another layout has this code.");
}

export async function createLayoutType(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof layoutTypeCreateSchema> },
): Promise<AdminLayoutType> {
  const result = await db.transaction(async (tx) => {
    await assertLayoutCodeFree(tx, input.code);
    await assertPlan(tx, input.planMediaId);
    const slug = await freeSlug(
      tx,
      layoutTypes,
      slugify(`${input.rooms} otaq ${input.areaTotal}`),
      "plan",
    );
    const [row] = await tx
      .insert(layoutTypes)
      .values({ ...input, slug })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "layout_type.create",
      entityType: "layout_type",
      entityId: row!.id,
      after: row,
      headers,
    });
    return getLayoutType(tx, row!.id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function updateLayoutType(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: Write & { id: string; input: z.output<typeof layoutTypeUpdateSchema> },
): Promise<AdminLayoutType> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(layoutTypes)
      .where(eq(layoutTypes.id, id))
      .for("update");
    if (!before) throw notFound("No such layout type.");
    if (input.code) await assertLayoutCodeFree(tx, input.code, id);
    await assertPlan(tx, input.planMediaId);
    const [after] = await tx
      .update(layoutTypes)
      .set(input)
      .where(eq(layoutTypes.id, id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "layout_type.update",
      entityType: "layout_type",
      entityId: id,
      before,
      after,
      headers,
    });
    return getLayoutType(tx, id);
  });
  revalidatePublic(publicTags.inventory);
  return result;
}

export async function deleteLayoutType(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(layoutTypes)
      .where(eq(layoutTypes.id, id))
      .for("update");
    if (!before) throw notFound("No such layout type.");
    const [used] = await tx
      .select({ n: count() })
      .from(apartments)
      .where(eq(apartments.layoutTypeId, id));
    if (used && used.n > 0) {
      throw inUse("Apartments still use this layout.", { apartments: used.n });
    }
    await tx.delete(layoutTypes).where(eq(layoutTypes.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "layout_type.delete",
      entityType: "layout_type",
      entityId: id,
      before,
      after: null,
      headers,
    });
  });
  revalidatePublic(publicTags.inventory);
}
