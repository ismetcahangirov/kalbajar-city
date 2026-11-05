import "server-only";

import { eq } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { homeSections } from "@/db/schema";
import { homeSections as seedSections } from "@/db/seed/data";
import { HttpError, notFound } from "@/lib/api/errors";
import { fieldErrors } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { resolveHomeSections } from "@/lib/public/home-sections";
import {
  homeSectionContentSchemas,
  homeSectionKeys,
  homeSectionMedia,
  homeSectionOrderSchema,
  type AdminHomeSection,
  type HomeSectionKey,
} from "@/shared/home-sections";
import { homeSectionScope } from "@/shared/placeholders";

import { assertMedia } from "./content";
import { clearChangedPlaceholders } from "./placeholders";

/**
 * Every home section as the site shows them: in order, hidden ones included,
 * and a section without a row with its defaults, so the screen works on a
 * database nobody has seeded.
 */
export async function listHomeSections(db: Executor): Promise<AdminHomeSection[]> {
  const rows = await db.select().from(homeSections);
  const saved = new Map(rows.map((row) => [row.key, row.updatedAt.toISOString()]));
  return resolveHomeSections(rows).map(
    (section, index) =>
      ({
        ...section,
        sortOrder: index,
        updatedAt: saved.get(section.key) ?? null,
      }) as AdminHomeSection,
  );
}

/** One home section's content: what is stored, else its defaults. */
export async function getHomeSection<K extends HomeSectionKey>(
  db: Executor,
  key: K,
): Promise<AdminHomeSection<K>> {
  const section = (await listHomeSections(db)).find((candidate) => candidate.key === key);
  if (!section) throw notFound("No such home section.");
  return section as AdminHomeSection<K>;
}

/** Writes the section's defaults if it has no row yet, in its default place. */
async function ensureRow(db: Executor, key: HomeSectionKey) {
  await db
    .insert(homeSections)
    .values({ key, sortOrder: homeSectionKeys.indexOf(key), content: seedSections[key] })
    .onConflictDoNothing();
}

/**
 * Replaces a home section's content with one that matches its key's schema,
 * audited in the same transaction, then revalidates the public pages that
 * read sections. The media it names must exist and be of the kind its scene
 * shows. The stand-ins the save changed lose their placeholder flag (#27).
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
    const { images, videos } = homeSectionMedia({ key, content: parsed.data });
    await assertMedia(tx, images, ["image"], "media");
    await assertMedia(tx, videos, ["video"], "videoMediaId");

    await ensureRow(tx, key);
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

/**
 * Saves the sections' order and which of them show, as one audited write,
 * then revalidates the home page. The schema has already refused a list that
 * misses a section or moves or hides the hero. Answers the sections as saved.
 */
export async function saveHomeSectionOrder(
  db: Executor,
  {
    input,
    user,
    headers,
  }: { input: z.output<typeof homeSectionOrderSchema>; user: SessionUser; headers: Headers },
): Promise<AdminHomeSection[]> {
  const result = await db.transaction(async (tx) => {
    // Two editors arranging at once take turns; the last whole list wins.
    await tx.select({ id: homeSections.id }).from(homeSections).for("update");
    const before = await listHomeSections(tx);
    for (const [sortOrder, { key, visible }] of input.sections.entries()) {
      await tx
        .insert(homeSections)
        .values({ key, sortOrder, visible, content: seedSections[key] })
        .onConflictDoUpdate({
          target: homeSections.key,
          set: { sortOrder, visible, updatedAt: new Date() },
        });
    }
    const summary = (sections: ReadonlyArray<{ key: string; visible: boolean }>) => ({
      order: sections.map(({ key }) => key),
      hidden: sections.filter(({ visible }) => !visible).map(({ key }) => key),
    });
    await audit(tx, {
      actorId: user.id,
      action: "home_section.order",
      entityType: "home_section",
      before: summary(before),
      after: summary(input.sections),
      headers,
    });
    return listHomeSections(tx);
  });

  revalidatePublic(publicTags.content);
  return result;
}
