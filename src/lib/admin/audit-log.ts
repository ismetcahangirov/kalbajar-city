import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNull, lt, or, type SQL } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { redactText, redactValue } from "@/lib/audit-redact";
import { offsetOf, toPage, type Page } from "@/shared/api";
import {
  auditSystemActor,
  type AdminAuditEntry,
  type AdminAuditListQuery,
  type AuditFilterOptions,
  type AuditRow,
} from "@/shared/audit";

import { bakuDayStart } from "./leads";

const dayMs = 24 * 60 * 60 * 1000;

function filters(query: AdminAuditListQuery): SQL | undefined {
  const named = query.actor.filter((actor) => actor !== auditSystemActor);
  const actors = [
    query.actor.includes(auditSystemActor) ? isNull(auditLog.actorId) : undefined,
    named.length ? inArray(auditLog.actorId, named) : undefined,
  ].filter((condition) => condition !== undefined);

  return and(
    actors.length ? or(...actors) : undefined,
    query.entityType.length ? inArray(auditLog.entityType, query.entityType) : undefined,
    query.entityId ? eq(auditLog.entityId, query.entityId) : undefined,
    query.from ? gte(auditLog.createdAt, bakuDayStart(query.from)) : undefined,
    // `to` includes its whole day.
    query.to
      ? lt(auditLog.createdAt, new Date(bakuDayStart(query.to).getTime() + dayMs))
      : undefined,
  );
}

function redactOptional(text: string | null): string | null {
  return text === null ? null : redactText(text);
}

/**
 * The audit log, newest first by default. Every text that leaves here is
 * redacted (`@/lib/audit-redact`). Entries of one transaction share a
 * timestamp, so the id settles their order and keeps pages stable.
 */
export async function listAuditLog(
  db: Executor,
  query: AdminAuditListQuery,
): Promise<Page<AdminAuditEntry>> {
  const where = filters(query);
  const direction = query.sort.direction === "desc" ? desc : asc;
  const [rows, [totals]] = await Promise.all([
    db
      .select({ entry: auditLog, actorName: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(where)
      .orderBy(direction(auditLog.createdAt), direction(auditLog.id))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(auditLog).where(where),
  ]);

  const items = rows.map(({ entry, actorName }): AdminAuditEntry => ({
    id: String(entry.id),
    action: entry.action,
    entityType: entry.entityType,
    entityId: redactOptional(entry.entityId),
    actor: entry.actorId ? { id: entry.actorId, name: actorName ?? "" } : null,
    before: redactValue(entry.before) as AuditRow | null,
    after: redactValue(entry.after) as AuditRow | null,
    ip: redactOptional(entry.ip),
    userAgent: redactOptional(entry.userAgent),
    createdAt: entry.createdAt.toISOString(),
  }));
  return toPage(items, totals?.total ?? 0, query);
}

/** Every console account and every entity type the log holds, for the filters. */
export async function auditFilterOptions(db: Executor): Promise<AuditFilterOptions> {
  const [actors, entityTypes] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)),
    db
      .selectDistinct({ entityType: auditLog.entityType })
      .from(auditLog)
      .orderBy(asc(auditLog.entityType)),
  ]);
  return { actors, entityTypes: entityTypes.map(({ entityType }) => entityType) };
}
