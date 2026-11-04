import "server-only";

import { and, asc, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { constructionUpdateMedia, constructionUpdates } from "@/db/schema";
import { invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { offsetOf, toPage, type Page } from "@/shared/api";
import type {
  AdminConstructionUpdate,
  constructionUpdateCreateSchema,
  constructionUpdateUpdateSchema,
  contentListQuerySchema,
  publicationSchema,
} from "@/shared/content";
import { contentState } from "@/shared/content";

import { assertMedia, publicationChange, resolveSlug, stateFilter } from "./content";

type Row = typeof constructionUpdates.$inferSelect;

type Write = { user: SessionUser; headers: Headers };

const entityType = "construction_update";

function toAdmin(row: Row, mediaIds: string[]): AdminConstructionUpdate {
  return {
    id: row.id,
    slug: row.slug,
    month: row.month,
    title: row.title,
    body: row.body,
    progressPercent: row.progressPercent,
    status: row.status,
    state: contentState(row),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    mediaIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Each update's media ids in display order. */
async function mediaOf(db: Executor, ids: string[]): Promise<Map<string, string[]>> {
  const result = new Map(ids.map((id) => [id, [] as string[]]));
  if (!ids.length) return result;
  const rows = await db
    .select({
      updateId: constructionUpdateMedia.updateId,
      mediaId: constructionUpdateMedia.mediaId,
    })
    .from(constructionUpdateMedia)
    .where(inArray(constructionUpdateMedia.updateId, ids))
    .orderBy(asc(constructionUpdateMedia.sortOrder), asc(constructionUpdateMedia.id));
  for (const row of rows) result.get(row.updateId)?.push(row.mediaId);
  return result;
}

async function locked(db: Executor, id: string): Promise<Row> {
  const [row] = await db
    .select()
    .from(constructionUpdates)
    .where(eq(constructionUpdates.id, id))
    .for("update");
  if (!row) throw notFound("No such construction update.");
  return row;
}

/** One update per month: the timeline groups by it. */
async function assertMonthFree(db: Executor, month: string, id?: string): Promise<void> {
  const same = eq(constructionUpdates.month, month);
  const [taken] = await db
    .select({ id: constructionUpdates.id })
    .from(constructionUpdates)
    .where(id ? and(same, ne(constructionUpdates.id, id)) : same);
  if (taken) throw invalidField("month", "There is already an update for this month.");
}

async function replaceMedia(db: Executor, id: string, mediaIds: string[]): Promise<void> {
  await db.delete(constructionUpdateMedia).where(eq(constructionUpdateMedia.updateId, id));
  if (mediaIds.length) {
    await db
      .insert(constructionUpdateMedia)
      .values(mediaIds.map((mediaId, sortOrder) => ({ updateId: id, mediaId, sortOrder })));
  }
}

export async function listConstructionUpdates(
  db: Executor,
  query: z.output<typeof contentListQuerySchema>,
): Promise<Page<AdminConstructionUpdate>> {
  const where: SQL | undefined = stateFilter(constructionUpdates, query.status);
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(constructionUpdates)
      .where(where)
      .orderBy(desc(constructionUpdates.month))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(constructionUpdates).where(where),
  ]);
  const files = await mediaOf(
    db,
    rows.map((row) => row.id),
  );
  return toPage(
    rows.map((row) => toAdmin(row, files.get(row.id) ?? [])),
    totals?.total ?? 0,
    query,
  );
}

export async function getConstructionUpdate(
  db: Executor,
  id: string,
): Promise<AdminConstructionUpdate> {
  const [row] = await db.select().from(constructionUpdates).where(eq(constructionUpdates.id, id));
  if (!row) throw notFound("No such construction update.");
  return toAdmin(row, (await mediaOf(db, [id])).get(id) ?? []);
}

/** A new update, as a draft, with its photos and video. */
export async function createConstructionUpdate(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof constructionUpdateCreateSchema> },
): Promise<AdminConstructionUpdate> {
  const result = await db.transaction(async (tx) => {
    await assertMonthFree(tx, input.month);
    await assertMedia(tx, input.mediaIds, ["image", "video"], "mediaIds");
    const slug = await resolveSlug(tx, constructionUpdates, {
      requested: input.slug,
      title: input.title,
      fallback: `tikinti-${input.month.slice(0, 7)}`,
    });
    const [row] = await tx
      .insert(constructionUpdates)
      .values({
        slug,
        month: input.month,
        title: input.title,
        body: input.body ?? null,
        progressPercent: input.progressPercent,
      })
      .returning();
    await replaceMedia(tx, row!.id, input.mediaIds);
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.create`,
      entityType,
      entityId: row!.id,
      after: { ...row!, mediaIds: input.mediaIds },
      headers,
    });
    return toAdmin(row!, input.mediaIds);
  });
  revalidatePublic(publicTags.content);
  return result;
}

export async function updateConstructionUpdate(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: Write & { id: string; input: z.output<typeof constructionUpdateUpdateSchema> },
): Promise<AdminConstructionUpdate> {
  const result = await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    if (input.month) await assertMonthFree(tx, input.month, id);
    const slug =
      input.slug === undefined
        ? undefined
        : await resolveSlug(tx, constructionUpdates, {
            requested: input.slug,
            title: input.title ?? before.title,
            fallback: "tikinti",
            id,
          });
    const [after] = await tx
      .update(constructionUpdates)
      .set({ ...input, ...(slug ? { slug } : {}) })
      .where(eq(constructionUpdates.id, id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.update`,
      entityType,
      entityId: id,
      before,
      after,
      headers,
    });
    return toAdmin(after!, (await mediaOf(tx, [id])).get(id) ?? []);
  });
  revalidatePublic(publicTags.content);
  return result;
}

/** Replaces the update's photos and video: attach, detach and reorder in one call. */
export async function setConstructionUpdateMedia(
  db: Executor,
  { id, mediaIds, user, headers }: Write & { id: string; mediaIds: string[] },
): Promise<AdminConstructionUpdate> {
  const result = await db.transaction(async (tx) => {
    const row = await locked(tx, id);
    await assertMedia(tx, mediaIds, ["image", "video"], "mediaIds");
    const before = (await mediaOf(tx, [id])).get(id) ?? [];
    await replaceMedia(tx, id, mediaIds);
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.media`,
      entityType,
      entityId: id,
      before: { mediaIds: before },
      after: { mediaIds },
      headers,
    });
    return toAdmin(row, mediaIds);
  });
  revalidatePublic(publicTags.content);
  return result;
}

/**
 * Publishes (`publish: true`), schedules (a future `publishedAt`), or
 * withdraws an update or cancels its schedule (`publish: false`).
 */
export async function setConstructionUpdatePublished(
  db: Executor,
  {
    id,
    publish,
    input,
    user,
    headers,
  }: Write & { id: string; publish: boolean; input?: z.output<typeof publicationSchema> },
): Promise<AdminConstructionUpdate> {
  const result = await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    const change = publish ? publicationChange(before, input?.publishedAt) : null;
    const [after] = await tx
      .update(constructionUpdates)
      .set(change ?? { status: "draft", scheduledAt: null })
      .where(eq(constructionUpdates.id, id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.${change ? (change.status === "draft" ? "schedule" : "publish") : "unpublish"}`,
      entityType,
      entityId: id,
      before,
      after,
      headers,
    });
    return toAdmin(after!, (await mediaOf(tx, [id])).get(id) ?? []);
  });
  revalidatePublic(publicTags.content);
  return result;
}

/** Removes an update and its media links; the files stay in the library. */
export async function deleteConstructionUpdate(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    const mediaIds = (await mediaOf(tx, [id])).get(id) ?? [];
    await tx.delete(constructionUpdates).where(eq(constructionUpdates.id, id));
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.delete`,
      entityType,
      entityId: id,
      before: { ...before, mediaIds },
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}
