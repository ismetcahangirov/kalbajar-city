import "server-only";

import { asc, eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { apartments, media, news, seoOverrides } from "@/db/schema";
import { invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import type { Translatable } from "@/i18n/content";
import { locales } from "@/i18n/routing";
import type {
  AdminSeoOverride,
  SeoOverrideParsed,
  SeoPage,
  SeoTexts,
} from "@/shared/seo-overrides";

import { t, type MessageKey } from "./messages";

/*
 * Overrides are read by `getSeoOverride()`, tagged `settings` and `media`, so
 * every write here revalidates `settings` and the next request carries the
 * new title, description and image.
 */

type Write = { user: SessionUser; headers: Headers };

type Row = typeof seoOverrides.$inferSelect;

/** The stored form: `null` when no language has a value, else every language, blanks as `null`. */
function toStored(texts: SeoTexts): Translatable | null {
  if (locales.every((locale) => !texts[locale])) return null;
  return { az: texts.az, en: texts.en || null, ru: texts.ru || null };
}

function toTexts(value: Translatable | null): SeoTexts {
  return { az: value?.az ?? "", en: value?.en ?? "", ru: value?.ru ?? "" };
}

function toAdmin(row: Row): AdminSeoOverride {
  return {
    id: row.id,
    path: row.path,
    title: toTexts(row.title),
    description: toTexts(row.description),
    ogMediaId: row.ogMediaId,
    noindex: row.noindex,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** What the audit log keeps of an override. */
function pick(row: Row) {
  return {
    path: row.path,
    title: row.title,
    description: row.description,
    ogMediaId: row.ogMediaId,
    noindex: row.noindex,
  };
}

export async function listSeoOverrides(db: Executor): Promise<AdminSeoOverride[]> {
  const rows = await db.select().from(seoOverrides).orderBy(asc(seoOverrides.path));
  return rows.map(toAdmin);
}

/** Creates (`id` absent) or replaces an override; a path has at most one. */
export async function saveSeoOverride(
  db: Executor,
  { id, input, user, headers }: Write & { id?: string; input: SeoOverrideParsed },
): Promise<AdminSeoOverride> {
  const saved = await db.transaction(async (tx) => {
    const [before] = id
      ? await tx.select().from(seoOverrides).where(eq(seoOverrides.id, id)).for("update")
      : [];
    if (id && !before) throw notFound("No such SEO override.");

    const [taken] = await tx
      .select({ id: seoOverrides.id })
      .from(seoOverrides)
      .where(eq(seoOverrides.path, input.path));
    if (taken && taken.id !== id) throw invalidField("path", "seo.error.taken");

    if (input.ogMediaId) {
      const [image] = await tx
        .select({ kind: media.kind })
        .from(media)
        .where(eq(media.id, input.ogMediaId));
      if (image?.kind !== "image") throw invalidField("ogMediaId", "seo.error.image");
    }

    const values = {
      path: input.path,
      title: toStored(input.title),
      description: toStored(input.description),
      ogMediaId: input.ogMediaId,
      noindex: input.noindex,
    };
    const [after] = before
      ? await tx.update(seoOverrides).set(values).where(eq(seoOverrides.id, before.id)).returning()
      : await tx.insert(seoOverrides).values(values).returning();
    await audit(tx, {
      actorId: user.id,
      action: before ? "seo_override.update" : "seo_override.create",
      entityType: "seo_override",
      entityId: after!.id,
      before: before ? pick(before) : null,
      after: pick(after!),
      headers,
    });
    return toAdmin(after!);
  });
  revalidatePublic(publicTags.settings);
  return saved;
}

export async function deleteSeoOverride(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx.delete(seoOverrides).where(eq(seoOverrides.id, id)).returning();
    if (!before) throw notFound("No such SEO override.");
    await audit(tx, {
      actorId: user.id,
      action: "seo_override.delete",
      entityType: "seo_override",
      entityId: id,
      before: pick(before),
      after: null,
      headers,
    });
  });
  revalidatePublic(publicTags.settings);
}

/** The site's own pages, by their Azerbaijani path, with the console's name for each. */
const staticPages: Array<{ path: string; label: MessageKey }> = [
  { path: "/", label: "seo.page.home" },
  { path: "/menziller", label: "seo.page.apartments" },
  { path: "/kompleks", label: "seo.page.complex" },
  { path: "/haqqimizda", label: "seo.page.about" },
  { path: "/yerlesme", label: "seo.page.location" },
  { path: "/tikinti", label: "seo.page.construction" },
  { path: "/qalereya", label: "seo.page.gallery" },
  { path: "/xeberler", label: "seo.page.news" },
  { path: "/elaqe", label: "seo.page.contact" },
  { path: "/mexfilik-siyaseti", label: "seo.page.privacy" },
];

/**
 * The pages the console offers to override: every route, every apartment and
 * every article. Any other path may still be typed in.
 */
export async function listSeoPages(db: Executor): Promise<SeoPage[]> {
  const [flats, articles] = await Promise.all([
    db
      .select({ slug: apartments.slug, number: apartments.number })
      .from(apartments)
      .orderBy(asc(apartments.slug)),
    db.select({ slug: news.slug, title: news.title }).from(news).orderBy(asc(news.slug)),
  ]);
  return [
    ...staticPages.map(({ path, label }) => ({ path, label: t(label), kind: "page" as const })),
    ...flats.map((flat) => ({
      path: `/menziller/${flat.slug}`,
      label: t("seo.page.apartment", { number: flat.number }),
      kind: "apartment" as const,
    })),
    ...articles.map((article) => ({
      path: `/xeberler/${article.slug}`,
      label: t("seo.page.article", { title: article.title.az }),
      kind: "news" as const,
    })),
  ];
}
