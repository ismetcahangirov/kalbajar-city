import { z } from "zod";

import { listOf, paginationSchema, sortSchema } from "./api";

/** The actor filter's value for writes no user made: scripts, the seed, retention. */
export const auditSystemActor = "system";

/**
 * What the server sends in place of a secret. The whole value when its field
 * is secret, or the secret part of a longer text.
 */
export const auditRedacted = "[REDACTED]";

const daySchema = z.iso.date();

/** `GET /api/v1/admin/audit`. Days are in Baku time; a range includes both ends. */
export const adminAuditListQuerySchema = paginationSchema
  .extend({
    /** User ids, or `system`. */
    actor: listOf(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Unknown user")),
    entityType: listOf(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, "Unknown entity type")),
    /** The entity's id, whole. */
    entityId: z.string().trim().min(1).max(200).optional(),
    from: daySchema.optional(),
    to: daySchema.optional(),
    sort: sortSchema(["createdAt"], "-createdAt"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "to must not be before from",
  });

export type AdminAuditListQuery = z.output<typeof adminAuditListQuerySchema>;

/** What a client passes; arrays go out comma-separated. */
export type AdminAuditListParams = {
  page?: number;
  pageSize?: number;
  actor?: string[];
  entityType?: string[];
  entityId?: string;
  from?: string;
  to?: string;
  sort?: "createdAt" | "-createdAt";
};

export type AuditRow = Record<string, unknown>;

/**
 * One entry as `audit()` stored it, secrets redacted. An update holds only
 * the changed fields on each side, a create only `after`, a removal only
 * `before`; an entry with neither records just that the action happened.
 */
export type AdminAuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  /** `null` when the system made the write. */
  actor: { id: string; name: string } | null;
  before: AuditRow | null;
  after: AuditRow | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AuditFilterOptions = {
  actors: Array<{ id: string; name: string }>;
  entityTypes: string[];
};

/** One field of an entry; a side without the field has no key of that name. */
export type AuditChange = { field: string; before?: unknown; after?: unknown };

/** An entry's fields in the order the log returns them, `before`'s first. */
export function auditChanges(entry: Pick<AdminAuditEntry, "before" | "after">): AuditChange[] {
  const { before, after } = entry;
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return fields.map((field) => ({
    field,
    ...(before && Object.hasOwn(before, field) ? { before: before[field] } : {}),
    ...(after && Object.hasOwn(after, field) ? { after: after[field] } : {}),
  }));
}
