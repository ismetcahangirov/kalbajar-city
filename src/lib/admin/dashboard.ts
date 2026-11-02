import "server-only";

import { asc, count, desc, eq, gte } from "drizzle-orm";

import type { Executor } from "@/db/client";
import {
  apartments,
  auditLog,
  blocks,
  buildings,
  constructionUpdates,
  faq,
  galleryCategories,
  galleryItems,
  homeSections,
  layoutTypes,
  leads,
  media,
  news,
  seoOverrides,
  settings,
  users,
} from "@/db/schema";
import { missingTranslations } from "@/i18n/content";
import { locales, type Locale } from "@/i18n/routing";
import { apartmentStatuses, type ApartmentStatus } from "@/shared/inventory";
import { leadStatuses, leadTypes, type LeadStatus, type LeadType } from "@/shared/leads";

import { leadSource } from "./leads";
import { translatablesIn } from "./translatables";
import { weekStart } from "./week";

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

export type LeadsThisWeek = {
  since: Date;
  total: number;
  byType: Record<LeadType, number>;
  byStatus: Record<LeadStatus, number>;
  /** The most frequent sources (`utm_source`, else the page), most leads first. */
  bySource: Array<{ source: string; total: number }>;
};

/** How many sources the dashboard lists before it stops. */
const topSources = 5;

/** Leads created since Monday 00:00 (Baku) of the week `now` falls in. */
export async function leadsThisWeek(db: Executor, now = new Date()): Promise<LeadsThisWeek> {
  const since = weekStart(now);
  const [rows, sources] = await Promise.all([
    db
      .select({ type: leads.type, status: leads.status, total: count() })
      .from(leads)
      .where(gte(leads.createdAt, since))
      .groupBy(leads.type, leads.status),
    db
      .select({ source: leadSource, total: count() })
      .from(leads)
      .where(gte(leads.createdAt, since))
      .groupBy(leadSource)
      .orderBy(desc(count()), asc(leadSource))
      .limit(topSources),
  ]);
  const result: LeadsThisWeek = {
    since,
    total: 0,
    byType: zeroed(leadTypes),
    byStatus: zeroed(leadStatuses),
    bySource: sources,
  };
  for (const row of rows) {
    result.total += row.total;
    result.byType[row.type] += row.total;
    result.byStatus[row.status] += row.total;
  }
  return result;
}

export async function apartmentsByStatus(
  db: Executor,
): Promise<{ total: number; byStatus: Record<ApartmentStatus, number> }> {
  const rows = await db
    .select({ status: apartments.status, total: count() })
    .from(apartments)
    .groupBy(apartments.status);
  const byStatus = zeroed(apartmentStatuses);
  for (const row of rows) byStatus[row.status] = row.total;
  return { total: rows.reduce((sum, row) => sum + row.total, 0), byStatus };
}

export type MissingTranslations = { total: number; byLocale: Record<Locale, number> };

/**
 * How many translations the site's content lacks, per locale, for the
 * dashboard: every translatable column and every translatable value inside
 * the JSON columns (home sections, settings).
 */
export async function missingTranslationCount(db: Executor): Promise<MissingTranslations> {
  const sources = await Promise.all([
    db.select({ a: buildings.name }).from(buildings),
    db.select({ a: blocks.name }).from(blocks),
    db.select({ a: layoutTypes.description }).from(layoutTypes),
    db.select({ a: galleryCategories.name }).from(galleryCategories),
    db.select({ a: galleryItems.caption }).from(galleryItems),
    db.select({ a: news.title, b: news.excerpt, c: news.body }).from(news),
    db
      .select({ a: constructionUpdates.title, b: constructionUpdates.body })
      .from(constructionUpdates),
    db.select({ a: faq.question, b: faq.answer }).from(faq),
    db.select({ a: homeSections.content }).from(homeSections),
    db.select({ a: media.alt, b: media.caption }).from(media),
    db.select({ a: seoOverrides.title, b: seoOverrides.description }).from(seoOverrides),
    db.select({ a: settings.value }).from(settings),
  ]);

  const byLocale = zeroed(locales);
  for (const field of sources.flat().flatMap((row) => translatablesIn(Object.values(row)))) {
    for (const { locale } of missingTranslations({ field })) byLocale[locale] += 1;
  }
  return { total: Object.values(byLocale).reduce((sum, value) => sum + value, 0), byLocale };
}

export type Activity = {
  id: number;
  action: string;
  entityType: string;
  actor: string | null;
  createdAt: Date;
};

/** The newest audit entries, with the actor's name (`null` for the system). */
export async function recentActivity(db: Executor, limit = 10): Promise<Activity[]> {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      actor: users.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);
}
