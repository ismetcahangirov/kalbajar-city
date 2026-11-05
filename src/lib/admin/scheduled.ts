import "server-only";

import { and, eq, isNotNull, lte } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { constructionUpdates, news } from "@/db/schema";
import { audit } from "@/lib/audit";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { hasRichContent } from "@/shared/rich-text";

export type ScheduledRun = {
  /** Ids of the articles published by this run. */
  news: string[];
  /** Ids of the construction updates published by this run. */
  constructionUpdates: string[];
  /** Ids of the due articles left scheduled because their Azerbaijani text is empty. */
  skippedNews: string[];
};

const due = (table: typeof news | typeof constructionUpdates, now: Date) =>
  and(eq(table.status, "draft"), isNotNull(table.scheduledAt), lte(table.scheduledAt, now));

/**
 * Publishes every draft whose scheduled time has come (#25), dated at its
 * scheduled time, audited as the system. Public pages are cached until a
 * write revalidates them, so a scheduled entry cannot appear on its own: a
 * cron calls this through `/api/v1/internal/scheduled-publications`.
 * Rows another run holds are skipped, so overlapping runs never publish an
 * entry twice. An article whose Azerbaijani text is empty stays scheduled
 * (the console refuses to empty a scheduled article, so this is a guard);
 * it is logged and returned in `skippedNews`, and the console shows it as
 * overdue.
 */
export async function publishScheduled(
  db: Executor,
  { headers, now = new Date() }: { headers?: Headers; now?: Date } = {},
): Promise<ScheduledRun> {
  const run = await db.transaction(async (tx) => {
    const result: ScheduledRun = { news: [], constructionUpdates: [], skippedNews: [] };

    const articles = await tx
      .select()
      .from(news)
      .where(due(news, now))
      .for("update", { skipLocked: true });
    for (const before of articles) {
      if (!hasRichContent(before.body.az)) {
        result.skippedNews.push(before.id);
        continue;
      }
      const [after] = await tx
        .update(news)
        .set({ status: "published", publishedAt: before.scheduledAt, scheduledAt: null })
        .where(eq(news.id, before.id))
        .returning();
      await audit(tx, {
        actorId: null,
        action: "news.publish",
        entityType: "news",
        entityId: before.id,
        before,
        after,
        headers,
      });
      result.news.push(before.id);
    }

    const updates = await tx
      .select()
      .from(constructionUpdates)
      .where(due(constructionUpdates, now))
      .for("update", { skipLocked: true });
    for (const before of updates) {
      const [after] = await tx
        .update(constructionUpdates)
        .set({ status: "published", publishedAt: before.scheduledAt, scheduledAt: null })
        .where(eq(constructionUpdates.id, before.id))
        .returning();
      await audit(tx, {
        actorId: null,
        action: "construction_update.publish",
        entityType: "construction_update",
        entityId: before.id,
        before,
        after,
        headers,
      });
      result.constructionUpdates.push(before.id);
    }
    return result;
  });
  if (run.skippedNews.length) {
    console.warn(
      `scheduled publication: articles left scheduled, their Azerbaijani text is empty: ${run.skippedNews.join(", ")}`,
    );
  }
  if (run.news.length || run.constructionUpdates.length) revalidatePublic(publicTags.content);
  return run;
}
