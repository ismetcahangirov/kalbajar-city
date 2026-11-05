import type { AdminAuditListParams } from "@/shared/audit";

import type { TableState } from "./table-state";

/** Where the list's filters live in the URL; keys are Azerbaijani like the routes. */
export const auditFilterKeys = {
  actor: "istifadeci",
  entityType: "obyekt",
  entityId: "obyekt-id",
  from: "tarixden",
  to: "tarixedek",
} as const;

/** The URL state as the list endpoint's parameters. */
export function auditListParams({
  page,
  pageSize,
  sort,
  filters,
}: TableState & { pageSize: number }): AdminAuditListParams {
  const from = filters[auditFilterKeys.from]?.[0];
  let to = filters[auditFilterKeys.to]?.[0];
  // A range the wrong way round would be refused; the end is dropped instead.
  if (from && to && to < from) to = undefined;
  return {
    page,
    pageSize,
    sort: sort as AdminAuditListParams["sort"],
    actor: filters[auditFilterKeys.actor],
    entityType: filters[auditFilterKeys.entityType],
    entityId: filters[auditFilterKeys.entityId]?.[0]?.trim() || undefined,
    from,
    to,
  };
}
