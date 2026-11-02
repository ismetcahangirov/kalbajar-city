import { and, inArray, isNull, sql } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { leadEvents, leadNotes, leads } from "@/db/schema";
import { audit } from "@/lib/audit";

import { leadSettings } from "./settings";

// Not server-only: scripts/leads-retention.mts runs it outside Next.

/** What a lead's name becomes once its personal data is cleared. */
export const anonymousName = "Anonim";

/** `months` calendar months before `now`, at the same time of day (UTC). */
export function monthsBefore(now: Date, months: number): Date {
  const date = new Date(now);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  // 31 March minus one month is the last day of February, not 3 March.
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}

/** The latest of the lead's own update and its newest timeline entry. */
const lastActivity = sql<Date>`greatest(${leads.updatedAt}, coalesce((select max(${leadEvents.createdAt}) from ${leadEvents} where ${leadEvents.leadId} = ${leads.id}), ${leads.updatedAt}))`;

export type RetentionReport = {
  retentionMonths: number;
  /** Leads last active before this instant are anonymised. */
  cutoff: Date;
  /** The leads that were (or, in a dry run, would be) anonymised. */
  ids: string[];
  dryRun: boolean;
};

/**
 * The retention job (#26): clears the personal data of every lead whose last
 * activity is older than `settings.leads.retentionMonths`. The name becomes
 * "Anonim"; phone, e-mail, message, referrer, UTM and the notes' text are
 * cleared, and `anonymised_at` is set, so a second run finds nothing. Each
 * lead is audited as the system (`actorId: null`) with an `anonymised` entry
 * on its timeline. The type, status, apartment, source page and dates stay
 * for the statistics.
 */
export async function anonymiseStaleLeads(
  db: Executor,
  { now = new Date(), dryRun = false }: { now?: Date; dryRun?: boolean } = {},
): Promise<RetentionReport> {
  const { retentionMonths } = await leadSettings(db);
  const cutoff = monthsBefore(now, retentionMonths);
  // A raw expression gets no column mapping, so the instant goes as text.
  const stale = and(
    isNull(leads.anonymisedAt),
    sql`${lastActivity} < ${cutoff.toISOString()}::timestamptz`,
  );

  if (dryRun) {
    const rows = await db.select({ id: leads.id }).from(leads).where(stale);
    return { retentionMonths, cutoff, ids: rows.map((row) => row.id), dryRun };
  }

  const ids = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(stale)
      .for("update", { skipLocked: true });
    const ids = rows.map((row) => row.id);
    if (!ids.length) return ids;

    await tx
      .update(leads)
      .set({
        name: anonymousName,
        phone: "",
        email: null,
        message: null,
        referrer: null,
        utm: null,
        anonymisedAt: now,
      })
      .where(inArray(leads.id, ids));
    await tx.update(leadNotes).set({ body: "" }).where(inArray(leadNotes.leadId, ids));
    await tx
      .insert(leadEvents)
      .values(ids.map((leadId) => ({ leadId, type: "anonymised" as const, createdAt: now })));
    for (const id of ids) {
      // The audit log never holds the cleared values: only the fact and when.
      await audit(tx, {
        actorId: null,
        action: "lead.anonymise",
        entityType: "lead",
        entityId: id,
        before: { anonymisedAt: null },
        after: { anonymisedAt: now },
      });
    }
    return ids;
  });
  return { retentionMonths, cutoff, ids, dryRun };
}
