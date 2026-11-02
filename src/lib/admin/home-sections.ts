import "server-only";

import { eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { homeSections } from "@/db/schema";
import { HttpError, notFound } from "@/lib/api/errors";
import { fieldErrors } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import {
  homeSectionContentSchemas,
  type AdminHomeSection,
  type HomeSectionContentByKey,
  type HomeSectionKey,
} from "@/shared/home-sections";
import { homeSectionScope } from "@/shared/placeholders";

import { clearChangedPlaceholders } from "./placeholders";

/** One home section's content, as stored; the seed writes every section. */
export async function getHomeSection<K extends HomeSectionKey>(
  db: Executor,
  key: K,
): Promise<AdminHomeSection<K>> {
  const [row] = await db.select().from(homeSections).where(eq(homeSections.key, key));
  if (!row) throw notFound("No such home section.");
  return {
    key,
    content: row.content as HomeSectionContentByKey[K],
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Replaces a home section's content with one that matches its key's schema,
 * audited in the same transaction, then revalidates the public pages that
 * read sections. The stand-ins the save changed lose their placeholder flag
 * (#27). The location section uses it now; the home page editor (#25) will
 * use it for the rest.
 */
export async function updateHomeSection<K extends HomeSectionKey>(
  db: Executor,
  {
    key,
    content,
    user,
    headers,
  }: { key: K; content: unknown; user: SessionUser; headers: Headers },
): Promise<AdminHomeSection<K>> {
  const parsed = homeSectionContentSchemas[key].safeParse(content);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "VALIDATION_FAILED",
      "The request has invalid fields.",
      fieldErrors(parsed.error),
    );
  }

  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(homeSections)
      .where(eq(homeSections.key, key))
      .for("update");
    if (!before) throw notFound("No such home section.");
    const [after] = await tx
      .update(homeSections)
      .set({ content: parsed.data, updatedAt: new Date() })
      .where(eq(homeSections.id, before.id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "home_section.update",
      entityType: "home_section",
      entityId: before.id,
      before: { content: before.content },
      after: { content: after!.content },
      headers,
    });
    await clearChangedPlaceholders(tx, {
      scope: homeSectionScope(key),
      before: before.content,
      after: after!.content,
      user,
      headers,
    });
    return getHomeSection(tx, key);
  });

  revalidatePublic(publicTags.content);
  return result;
}
