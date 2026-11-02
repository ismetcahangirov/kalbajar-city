import "server-only";

import { and, count, desc, eq, ne } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import type { Executor } from "@/db/client";
import { news } from "@/db/schema";
import { localize, type Localized } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { toPage, type Page } from "@/shared/api";
import { richTextMediaIds } from "@/shared/rich-text";

import { toPublicImage, type PublicImage } from "./media";
import { localizeRichText, mediaById, summary, withImages, type PublicRichText } from "./rich-text";

export type PublicNewsSummary = {
  slug: string;
  title: Localized;
  /** The excerpt, or the start of the first paragraph when there is none. */
  excerpt: Localized | null;
  cover: PublicImage | null;
  /** ISO timestamp. */
  publishedAt: string;
};

export type PublicNewsArticle = PublicNewsSummary & {
  /** The excerpt the editor wrote, shown as the lead; never the body's own start again. */
  lead: Localized | null;
  body: PublicRichText;
  /** The latest other articles. */
  related: PublicNewsSummary[];
};

export const newsPageSize = 12;

const relatedCount = 3;

type Row = typeof news.$inferSelect;

const published = eq(news.status, "published");

const newestFirst = [desc(news.publishedAt), desc(news.id)];

function summarise(
  row: Row,
  files: Awaited<ReturnType<typeof mediaById>>,
  locale: Locale,
): PublicNewsSummary {
  let excerpt = row.excerpt ? localize(row.excerpt, locale) : null;
  if (!excerpt) {
    const body = localizeRichText(row.body, locale);
    const text = summary(body.blocks);
    excerpt = text ? { value: text, locale: body.locale, fallback: body.fallback } : null;
  }
  return {
    slug: row.slug,
    title: localize(row.title, locale),
    excerpt,
    cover: row.coverMediaId ? toPublicImage(files.get(row.coverMediaId), locale) : null,
    // A published row always has a date (`news_published_has_date`).
    publishedAt: row.publishedAt!.toISOString(),
  };
}

const covers = (rows: Row[]) => rows.flatMap((row) => (row.coverMediaId ? [row.coverMediaId] : []));

/** One page of published articles, newest first. */
export async function loadNewsPage(
  db: Executor,
  locale: Locale,
  page: number,
): Promise<Page<PublicNewsSummary>> {
  const pagination = { page, pageSize: newsPageSize };
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(news)
      .where(published)
      .orderBy(...newestFirst)
      .limit(newsPageSize)
      .offset((page - 1) * newsPageSize),
    db.select({ total: count() }).from(news).where(published),
  ]);
  const files = await mediaById(db, covers(rows));
  return toPage(
    rows.map((row) => summarise(row, files, locale)),
    totals?.total ?? 0,
    pagination,
  );
}

/** A published article with its related articles, or null for a draft or an unknown slug. */
export async function loadNewsArticle(
  db: Executor,
  locale: Locale,
  slug: string,
): Promise<PublicNewsArticle | null> {
  const [row] = await db
    .select()
    .from(news)
    .where(and(published, eq(news.slug, slug)));
  if (!row) return null;
  const others = await db
    .select()
    .from(news)
    .where(and(published, ne(news.id, row.id)))
    .orderBy(...newestFirst)
    .limit(relatedCount);

  const body = localizeRichText(row.body, locale);
  const files = await mediaById(db, [
    ...covers([row, ...others]),
    ...richTextMediaIds(body.blocks),
  ]);
  return {
    ...summarise(row, files, locale),
    lead: row.excerpt ? localize(row.excerpt, locale) : null,
    body: withImages(body, files, locale),
    related: others.map((other) => summarise(other, files, locale)),
  };
}

/** `/xeberler`'s data, cached until the console changes content or media. */
export async function getNewsPage(locale: Locale, page: number): Promise<Page<PublicNewsSummary>> {
  "use cache";
  cacheTag(publicTags.content, publicTags.media);
  cacheLife("days");
  return loadNewsPage(getDb(), locale, page);
}

export async function getNewsArticle(
  locale: Locale,
  slug: string,
): Promise<PublicNewsArticle | null> {
  "use cache";
  cacheTag(publicTags.content, publicTags.media);
  cacheLife("days");
  return loadNewsArticle(getDb(), locale, slug);
}
