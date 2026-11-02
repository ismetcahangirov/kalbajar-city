import type { Executor } from "@/db/client";
import { auditLog } from "@/db/schema";

type Row = Record<string, unknown>;

export type AuditEntry = {
  /** The signed-in user, or `null` for the system (scripts, the seed). */
  actorId: string | null;
  /** `<entity>.<verb>`, e.g. `apartment.update`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  /** The entity before the write; `null` when it was created. */
  before?: Row | null;
  /** The entity after the write; `null` when it was removed. */
  after?: Row | null;
  /** The request's headers, for the IP and user agent. */
  headers?: Headers | null;
};

/** Fields never written to the log, whatever entity they belong to. */
const secretFields = new Set(["password", "token", "accessToken", "refreshToken", "idToken"]);

function plain(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(plain(a)) === JSON.stringify(plain(b));
}

function clean(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !secretFields.has(key))
      .map(([key, value]) => [key, plain(value)]),
  );
}

/**
 * The fields that changed, each side holding only those. A created entity
 * keeps its whole `after`, a removed one its whole `before`.
 */
export function diff(
  before: Row | null | undefined,
  after: Row | null | undefined,
): { before: Row | null; after: Row | null } {
  if (!before || !after) {
    return { before: before ? clean(before) : null, after: after ? clean(after) : null };
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => !secretFields.has(key) && key !== "updatedAt" && !same(before[key], after[key]),
  );
  const pick = (row: Row) => Object.fromEntries(keys.map((key) => [key, plain(row[key])]));
  return { before: pick(before), after: pick(after) };
}

/** The client's address as the reverse proxy reports it. */
export function clientIp(headers: Headers | null | undefined): string | null {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers?.get("x-real-ip")?.trim() || null;
}

/**
 * Records a privileged write (`CLAUDE.md` §4). Pass the transaction that made
 * the write, so the entry and the change commit or roll back together. An
 * update that changed nothing is not recorded.
 */
export async function audit(db: Executor, entry: AuditEntry): Promise<void> {
  const changes = diff(entry.before, entry.after);
  const isUpdate = entry.before && entry.after;
  if (isUpdate && Object.keys(changes.after ?? {}).length === 0) return;

  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: changes.before,
    after: changes.after,
    ip: clientIp(entry.headers),
    userAgent: entry.headers?.get("user-agent") ?? null,
  });
}

/**
 * Records many writes in one insert, e.g. one entry per apartment of a bulk
 * change or an import. Entries that changed nothing are left out, as in
 * `audit()`.
 */
export async function auditMany(db: Executor, entries: AuditEntry[]): Promise<void> {
  const rows = entries.flatMap((entry) => {
    const changes = diff(entry.before, entry.after);
    if (entry.before && entry.after && Object.keys(changes.after ?? {}).length === 0) return [];
    return [
      {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: changes.before,
        after: changes.after,
        ip: clientIp(entry.headers),
        userAgent: entry.headers?.get("user-agent") ?? null,
      },
    ];
  });
  // Postgres takes at most 65 535 parameters per statement; 8 per row.
  for (let start = 0; start < rows.length; start += 1000) {
    await db.insert(auditLog).values(rows.slice(start, start + 1000));
  }
}
