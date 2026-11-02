import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import type { Executor } from "@/db/client";
import { constructionUpdateMedia, constructionUpdates } from "@/db/schema";
import { localize, type Localized } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { richTextMediaIds } from "@/shared/rich-text";

import { toPublicImage, toPublicVideo, type PublicImage, type PublicVideo } from "./media";
import {
  localizeRichText,
  mediaById,
  withImages,
  withPosters,
  type PublicRichText,
} from "./rich-text";

export type PublicConstructionMedia =
  | { kind: "image"; id: string; image: PublicImage; caption: Localized | null }
  | {
      kind: "video";
      id: string;
      video: PublicVideo;
      caption: Localized | null;
      /** The file's alt text, if the library has one: the player's accessible name. */
      label: Localized | null;
    };

export type PublicConstructionUpdate = {
  id: string;
  /** The first day of the month, `2026-09-01`. */
  month: string;
  title: Localized;
  body: PublicRichText | null;
  progressPercent: number;
  media: PublicConstructionMedia[];
};

/**
 * Published construction updates, newest month first, each with the photos
 * and video that may be shown. Drafts never leave the database here.
 */
export async function loadConstructionTimeline(
  db: Executor,
  locale: Locale,
): Promise<PublicConstructionUpdate[]> {
  const updates = await db
    .select()
    .from(constructionUpdates)
    .where(eq(constructionUpdates.status, "published"))
    .orderBy(desc(constructionUpdates.month));
  if (!updates.length) return [];

  const links = await db
    .select({
      updateId: constructionUpdateMedia.updateId,
      mediaId: constructionUpdateMedia.mediaId,
    })
    .from(constructionUpdateMedia)
    .where(
      inArray(
        constructionUpdateMedia.updateId,
        updates.map((update) => update.id),
      ),
    )
    .orderBy(asc(constructionUpdateMedia.sortOrder), asc(constructionUpdateMedia.id));

  const bodies = new Map(
    updates.map((update) => [
      update.id,
      update.body ? localizeRichText(update.body, locale) : null,
    ]),
  );
  const files = await withPosters(
    db,
    await mediaById(db, [
      ...links.map((link) => link.mediaId),
      ...[...bodies.values()].flatMap((body) => richTextMediaIds(body?.blocks ?? [])),
    ]),
  );

  return updates.map((update) => {
    const body = bodies.get(update.id);
    const media = links
      .filter((link) => link.updateId === update.id)
      .flatMap((link): PublicConstructionMedia[] => {
        const row = files.get(link.mediaId);
        const caption = row?.caption ? localize(row.caption, locale) : null;
        const image = toPublicImage(row, locale);
        if (image) return [{ kind: "image", id: link.mediaId, image, caption }];
        const video = toPublicVideo(row, locale, files);
        if (video) {
          const label = row?.alt?.az?.trim() ? localize(row.alt, locale) : null;
          return [{ kind: "video", id: link.mediaId, video, caption, label }];
        }
        return [];
      });
    return {
      id: update.id,
      month: update.month,
      title: localize(update.title, locale),
      body: body?.blocks.length ? withImages(body, files, locale) : null,
      progressPercent: update.progressPercent,
      media,
    };
  });
}

/** `/tikinti`'s data, cached until the console changes content or media. */
export async function getConstructionTimeline(locale: Locale): Promise<PublicConstructionUpdate[]> {
  "use cache";
  cacheTag(publicTags.content, publicTags.media);
  cacheLife("days");
  return loadConstructionTimeline(getDb(), locale);
}
