import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { faq } from "@/db/schema";
import { notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import type { AdminFaq, faqCreateSchema, faqUpdateSchema } from "@/shared/faq";
import type { orderSchema } from "@/shared/ordering";

import { assertMayPublish, assertSameMembers } from "./ordering";

type Row = typeof faq.$inferSelect;

type Write = { user: SessionUser; headers: Headers };

const entityType = "faq";

/** The site's order: `sort_order`, then age, so equal positions stay stable. */
export const faqOrder = [asc(faq.sortOrder), asc(faq.createdAt), asc(faq.id)];

function toAdmin(row: Row): AdminFaq {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function locked(db: Executor, id: string): Promise<Row> {
  const [row] = await db.select().from(faq).where(eq(faq.id, id)).for("update");
  if (!row) throw notFound("No such question.");
  return row;
}

/** Every question, drafts included, in the site's order. */
export async function listFaq(db: Executor): Promise<AdminFaq[]> {
  const rows = await db
    .select()
    .from(faq)
    .orderBy(...faqOrder);
  return rows.map(toAdmin);
}

/** A new question, at the end of the list. */
export async function createFaq(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof faqCreateSchema> },
): Promise<AdminFaq> {
  if (input.status === "published") assertMayPublish(user);
  const result = await db.transaction(async (tx) => {
    // Two concurrent appends may share a position; `faqOrder` keeps them apart.
    const [last] = await tx.select({ max: sql<number | null>`max(${faq.sortOrder})` }).from(faq);
    const [row] = await tx
      .insert(faq)
      .values({
        question: input.question,
        answer: input.answer,
        status: input.status,
        sortOrder: (last?.max ?? -1) + 1,
      })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.create`,
      entityType,
      entityId: row!.id,
      after: row,
      headers,
    });
    return toAdmin(row!);
  });
  revalidatePublic(publicTags.content);
  return result;
}

export async function updateFaq(
  db: Executor,
  { id, input, user, headers }: Write & { id: string; input: z.output<typeof faqUpdateSchema> },
): Promise<AdminFaq> {
  const result = await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    if (input.status && input.status !== before.status) assertMayPublish(user);
    const [after] = await tx.update(faq).set(input).where(eq(faq.id, id)).returning();
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.update`,
      entityType,
      entityId: id,
      before,
      after,
      headers,
    });
    return toAdmin(after!);
  });
  revalidatePublic(publicTags.content);
  return result;
}

export async function deleteFaq(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    await tx.delete(faq).where(eq(faq.id, id));
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.delete`,
      entityType,
      entityId: id,
      before,
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}

/**
 * Puts every question in the given order. It is the order of the FAQ on the
 * site and in its `FAQPage` structured data.
 */
export async function reorderFaq(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof orderSchema> },
): Promise<AdminFaq[]> {
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(faq)
      .orderBy(...faqOrder)
      .for("update");
    assertSameMembers(
      rows.map((row) => row.id),
      input.ids,
    );
    const before = rows.map((row) => row.id);
    for (const [index, id] of input.ids.entries()) {
      const row = rows.find((candidate) => candidate.id === id)!;
      if (row.sortOrder !== index) {
        await tx.update(faq).set({ sortOrder: index }).where(eq(faq.id, id));
      }
    }
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.reorder`,
      entityType,
      before: { order: before },
      after: { order: input.ids },
      headers,
    });
    return listFaq(tx);
  });
  revalidatePublic(publicTags.content);
  return result;
}
