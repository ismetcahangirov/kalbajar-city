"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import type { DataTableAnyFilter } from "@/components/admin/data-table/controls";
import { DataTable } from "@/components/admin/data-table/data-table";
import { auditActionLabel, auditEntityLabel } from "@/lib/admin/audit-labels";
import { auditFilterKeys, auditListParams } from "@/lib/admin/audit-list";
import { adminDateTime } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import {
  auditChanges,
  auditSystemActor,
  type AdminAuditEntry,
  type AdminAuditListParams,
  type AuditFilterOptions,
} from "@/shared/audit";
import { useAdminAuditLogQuery } from "@/store/endpoints/admin-audit";

import { AuditDetails } from "./audit-details";

/** How many changed fields a row names before it only counts the rest. */
const namedFields = 3;

/** Any write adds to the log, so returning to the page asks for it again. */
function useAuditList(params: AdminAuditListParams) {
  return useAdminAuditLogQuery(params, { refetchOnMountOrArgChange: true });
}

function ChangedFields({ entry }: { entry: AdminAuditEntry }) {
  const fields = auditChanges(entry).map((change) => change.field);
  if (fields.length === 0) {
    return <span className="text-muted-foreground">{t("audit.log.noFields")}</span>;
  }
  const rest = fields.length - namedFields;
  return (
    <span className="wrap-anywhere">
      {fields.slice(0, namedFields).join(", ")}
      {rest > 0 ? ` ${t("audit.log.moreFields", { count: rest })}` : null}
    </span>
  );
}

const columns: ColumnDef<AdminAuditEntry>[] = [
  {
    id: "action",
    meta: { label: t("audit.log.action"), primary: true },
    cell: ({ row }) => auditActionLabel(row.original.action),
  },
  {
    id: "entity",
    meta: { label: t("audit.log.entity") },
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col md:max-w-48">
        {auditEntityLabel(row.original.entityType)}
        {row.original.entityId ? (
          <span className="text-muted-foreground font-mono text-xs wrap-anywhere">
            {row.original.entityId}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "actor",
    meta: { label: t("audit.log.actor") },
    cell: ({ row }) =>
      row.original.actor?.name ?? (
        <span className="text-muted-foreground">{t("audit.log.system")}</span>
      ),
  },
  {
    id: "createdAt",
    meta: { label: t("audit.log.createdAt"), sortField: "createdAt" },
    cell: ({ row }) => (
      <time dateTime={row.original.createdAt} className="whitespace-nowrap">
        {adminDateTime(row.original.createdAt)}
      </time>
    ),
  },
  {
    id: "changes",
    meta: { label: t("audit.log.changes") },
    cell: ({ row }) => <ChangedFields entry={row.original} />,
  },
  {
    id: "details",
    meta: { label: t("audit.log.details"), align: "end" },
    cell: ({ row }) => <AuditDetails entry={row.original} />,
  },
];

/**
 * The audit log (#27): read-only, newest first, filters in the URL. A row names
 * what changed; its dialog shows the values, which the server has redacted.
 */
export function AuditLog({ actors, entityTypes }: AuditFilterOptions) {
  const filters = useMemo<DataTableAnyFilter[]>(
    () => [
      {
        key: auditFilterKeys.actor,
        label: t("audit.log.actor"),
        options: [
          { value: auditSystemActor, label: t("audit.log.system") },
          ...actors.map((actor) => ({ value: actor.id, label: actor.name })),
        ],
      },
      {
        key: auditFilterKeys.entityType,
        label: t("audit.log.entity"),
        options: entityTypes.map((type) => ({ value: type, label: auditEntityLabel(type) })),
      },
      {
        key: auditFilterKeys.entityId,
        label: t("audit.log.entityId"),
        kind: "text",
        placeholder: t("audit.log.entityIdHint"),
      },
      { key: auditFilterKeys.from, label: t("leads.from"), kind: "date" },
      { key: auditFilterKeys.to, label: t("leads.to"), kind: "date" },
    ],
    [actors, entityTypes],
  );

  return (
    <DataTable<AdminAuditEntry, AdminAuditListParams>
      caption={t("audit.log.caption")}
      columns={columns}
      defaultSort="-createdAt"
      filters={filters}
      useList={useAuditList}
      toParams={auditListParams}
      getRowId={(item) => item.id}
    />
  );
}
