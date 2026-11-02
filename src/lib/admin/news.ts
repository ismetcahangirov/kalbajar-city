import "server-only";

import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { mediaUsages, news } from "@/db/schema";
import { invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { offsetOf, toPage, type Page } from "@/shared/api";
import type {
  AdminNews,
  contentListQuerySchema,
  newsCreateSchema,
  newsUpdateSchema,
  publicationSchema,
} from "@/shared/content";
import {
  hasRichContent,
  richTextMediaIds,
  sanitizeRichText,
  type TranslatableRichText,
} from "@/shared/rich-text";

import { assertMedia, publicationDate, resolveSlug } from "./content";

type Row = typeof news.$inferSelect;

type Write = { user: SessionUser; headers: Headers };

const entityType = "news";

/** The `media_usages` slot of images embedded in an article's body. */
const bodyField = "body";

function toAdmin(row: Row): AdminNews {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    coverMediaId: row.coverMediaId,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Every library image the body shows, in any language. */
function embeddedMedia(body: TranslatableRichText): string[] {
  const docs = [body.az, body.en, body.ru];
  return [...new Set(docs.flatMap((doc) => richTextMediaIds(sanitizeRichText(doc))))];
}

/**
 * Records the body's embedded images in `media_usages`, so the library lists
 * the article as a usage and refuses to delete a file it shows (#11).
 */
async function syncBodyUsages(db: Executor, id: string, mediaIds: string[]): Promise<void> {
  await db
    .delete(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, id),
        eq(mediaUsages.field, bodyField),
      ),
    );
  if (mediaIds.length) {
    await db
      .insert(mediaUsages)
      .values(mediaIds.map((mediaId) => ({ mediaId, entityType, entityId: id, field: bodyField })));
  }
}

async function locked(db: Executor, id: string): Promise<Row> {
  const [row] = await db.select().from(news).where(eq(news.id, id)).for("update");
  if (!row) throw notFound("No such article.");
  return row;
}

export async function listNews(
  db: Executor,
  query: z.output<typeof contentListQuerySchema>,
): Promise<Page<AdminNews>> {
  const where: SQL | undefined = query.status.length
    ? inArray(news.status, query.status)
    : undefined;
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(news)
      .where(where)
      // Published by date, then drafts by their last edit.
      .orderBy(sql`${news.publishedAt} desc nulls last`, desc(news.updatedAt))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(news).where(where),
  ]);
  return toPage(rows.map(toAdmin), totals?.total ?? 0, query);
}

export async function getNews(db: Executor, id: string): Promise<AdminNews> {
  const [row] = await db.select().from(news).where(eq(news.id, id));
  if (!row) throw notFound("No such article.");
  return toAdmin(row);
}

/** A new article, as a draft. */
export async function createNews(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof newsCreateSchema> },
): Promise<AdminNews> {
  const result = await db.transaction(async (tx) => {
    const embedded = embeddedMedia(input.body);
    await assertMedia(
      tx,
      input.coverMediaId ? [input.coverMediaId] : [],
      ["image"],
      "coverMediaId",
    );
    await assertMedia(tx, embedded, ["image"], "body");
    const slug = await resolveSlug(tx, news, {
      requested: input.slug,
      title: input.title,
      fallback: "xeber",
    });
    const [row] = await tx
      .insert(news)
      .values({
        slug,
        title: input.title,
        excerpt: input.excerpt ?? null,
        body: input.body,
        coverMediaId: input.coverMediaId ?? null,
      })
      .returning();
    await syncBodyUsages(tx, row!.id, embedded);
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

export async function updateNews(
  db: Executor,
  { id, input, user, headers }: Write & { id: string; input: z.output<typeof newsUpdateSchema> },
): Promise<AdminNews> {
  const result = await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    if (input.coverMediaId) await assertMedia(tx, [input.coverMediaId], ["image"], "coverMediaId");
    if (input.body) {
      // A published article cannot be emptied: it would publish a blank page.
      if (before.status === "published" && !hasRichContent(input.body.az)) {
        throw invalidField("body.az", "A published article needs its Azerbaijani text.");
      }
      const embedded = embeddedMedia(input.body);
      await assertMedia(tx, embedded, ["image"], "body");
      await syncBodyUsages(tx, id, embedded);
    }
    const slug =
      input.slug === undefined
        ? undefined
        : await resolveSlug(tx, news, {
            requested: input.slug,
            title: input.title ?? before.title,
            fallback: "xeber",
            id,
          });
    const [after] = await tx
      .update(news)
      .set({ ...input, ...(slug ? { slug } : {}) })
      .where(eq(news.id, id))
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
    return toAdmin(after!);
  });
  revalidatePublic(publicTags.content);
  return result;
}

/** Publishes (`publish: true`) or withdraws an article. An empty article is not published. */
export async function setNewsPublished(
  db: Executor,
  {
    id,
    publish,
    input,
    user,
    headers,
  }: Write & { id: string; publish: boolean; input?: z.output<typeof publicationSchema> },
): Promise<AdminNews> {
  const result = await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    if (publish && !hasRichContent(before.body.az)) {
      throw invalidField("body.az", "Write the article's Azerbaijani text before publishing it.");
    }
    const [after] = await tx
      .update(news)
      .set(
        publish
          ? {
              status: "published",
              publishedAt: publicationDate(before.publishedAt, input?.publishedAt),
            }
          : { status: "draft" },
      )
      .where(eq(news.id, id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: `${entityType}.${publish ? "publish" : "unpublish"}`,
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

/** Removes an article; its cover and embedded images stay in the library. */
export async function deleteNews(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await locked(tx, id);
    await syncBodyUsages(tx, id, []);
    await tx.delete(news).where(eq(news.id, id));
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
