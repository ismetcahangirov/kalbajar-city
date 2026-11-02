import "server-only";

import { and, eq, inArray, like, ne, type SQL } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { constructionUpdates, media, news } from "@/db/schema";
import type { Translatable } from "@/i18n/content";
import { invalidField } from "@/lib/api/errors";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { MediaKind } from "@/shared/media";

/**
 * What the construction-update and news writes share (#21): slugs, checks on
 * referenced files, and the publication date rule.
 */

type SlugTable = typeof news | typeof constructionUpdates;

/**
 * The slug to store: the requested one if no other row has it, else one made
 * from the Azerbaijani title, suffixed until it is free.
 */
export async function resolveSlug(
  db: Executor,
  table: SlugTable,
  {
    requested,
    title,
    fallback,
    id,
  }: { requested?: string; title: Translatable; fallback: string; id?: string },
): Promise<string> {
  const others = (condition: SQL) =>
    db
      .select({ slug: table.slug })
      .from(table)
      .where(id ? and(condition, ne(table.id, id)) : condition);

  if (requested) {
    if ((await others(eq(table.slug, requested))).length) {
      throw invalidField("slug", "This slug is already in use.");
    }
    return requested;
  }
  const base = slugify(title.az) || fallback;
  // slugify leaves only [a-z0-9-], so the pattern has no wildcards of its own.
  const taken = await others(like(table.slug, `${base}%`));
  return uniqueSlug(base, new Set(taken.map((row) => row.slug)));
}

/** Refuses ids that name no file, or a file of a kind the field cannot show. */
export async function assertMedia(
  db: Executor,
  ids: readonly string[],
  kinds: readonly MediaKind[],
  field: string,
): Promise<void> {
  if (!ids.length) return;
  const rows = await db
    .select({ id: media.id, kind: media.kind })
    .from(media)
    .where(inArray(media.id, [...ids]));
  const found = new Map(rows.map((row) => [row.id, row.kind]));
  for (const id of ids) {
    const kind = found.get(id);
    if (!kind) throw invalidField(field, `No such file: ${id}.`);
    if (!kinds.includes(kind)) throw invalidField(field, `The file ${id} is a ${kind}.`);
  }
}

/**
 * When a published entry says it was published. A requested date must not be
 * in the future (`publicationSchema`); without one, an entry published before
 * keeps its date, so unpublishing to fix a typo does not move it up the list.
 */
export function publicationDate(
  current: Date | null,
  requested: string | undefined,
  now = new Date(),
): Date {
  if (requested) {
    const date = new Date(requested);
    if (date.getTime() > now.getTime()) {
      throw invalidField("publishedAt", "The publication date cannot be in the future.");
    }
    return date;
  }
  return current && current.getTime() <= now.getTime() ? current : now;
}
