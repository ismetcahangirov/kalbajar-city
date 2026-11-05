import { getDb } from "@/db";
import { listAuditLog } from "@/lib/admin/audit-log";
import { handler } from "@/lib/api/handler";
import { adminAuditListQuerySchema } from "@/shared/audit";

/** The audit log, read-only: filtered by user, entity and day, secrets redacted. */
export const GET = handler(
  { auth: { audit: ["read"] }, query: adminAuditListQuerySchema },
  ({ query }) => listAuditLog(getDb(), query),
);
