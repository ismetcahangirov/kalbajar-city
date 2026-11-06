import "server-only";

import { and, eq, inArray, isNotNull, isNull, like, ne, or, type SQL } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { constructionUpdates, galleryCategories, media, news } from "@/db/schema";
import type { Translatable } from "@/i18n/content";
import { invalidField } from "@/lib/api/errors";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { ContentState, PublishStatus } from "@/shared/content";
import type { MediaKind } from "@/shared/media";

/**
 * What the construction-update and news writes share (#21): slugs, checks on
 * referenced files, and the publication date rule.
 */

type SlugTable = typeof news | typeof constructionUpdates | typeof galleryCategories;

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
 * When a published entry says it was published: the requested date, or else
 * the date it was first published, so unpublishing to fix a typo does not
 * move it up the list, or else now.
 */
export function publicationDate(
  current: Date | null,
  requested: Date | undefined,
  now = new Date(),
): Date {
  if (requested) return requested;
  return current && current.getTime() <= now.getTime() ? current : now;
}

export type PublicationChange =
  | { status: "published"; publishedAt: Date; scheduledAt: null }
  | { status: "draft"; scheduledAt: Date };

/**
 * What `PUT .../publication` does to an entry (`publicationSchema`): a date
 * in the future schedules a draft, anything else publishes now. A published
 * entry is withdrawn before it is scheduled again, so scheduling never takes
 * a live page down by surprise.
 */
export function publicationChange(
  before: { status: PublishStatus; publishedAt: Date | null },
  requested: string | undefined,
  now = new Date(),
): PublicationChange {
  const date = requested ? new Date(requested) : undefined;
  if (date && date.getTime() > now.getTime()) {
    if (before.status === "published") {
      throw invalidField("publishedAt", "Withdraw the published entry before scheduling it.");
    }
    return { status: "draft", scheduledAt: date };
  }
  return {
    status: "published",
    publishedAt: publicationDate(before.publishedAt, date, now),
    scheduledAt: null,
  };
}

type StateTable = typeof news | typeof constructionUpdates;

/** The list filter for console states: a scheduled entry is a draft with a date. */
export function stateFilter(table: StateTable, states: readonly ContentState[]): SQL | undefined {
  if (!states.length) return undefined;
  return or(
    ...states.map((state) =>
      state === "published"
        ? eq(table.status, "published")
        : and(
            eq(table.status, "draft"),
            state === "scheduled" ? isNotNull(table.scheduledAt) : isNull(table.scheduledAt),
          ),
    ),
  );
}
