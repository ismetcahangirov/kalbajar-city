"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

import { isDateFilter, type DataTableAnyFilter } from "@/components/admin/data-table/controls";
import { DataTable } from "@/components/admin/data-table/data-table";
import { formatPhone } from "@/i18n/format";
import { adminDateTime } from "@/lib/admin/format";
import { leadTelHref } from "@/lib/admin/lead-links";
import { t } from "@/lib/admin/messages";
import { leadFilterKeys, leadListParams, leadsHref } from "@/lib/admin/lead-list";
import {
  assigneeKeywords,
  leadStatuses,
  leadTypes,
  type AdminLead,
  type AdminLeadListParams,
  type LeadUser,
} from "@/shared/leads";
import { useAdminLeadsQuery } from "@/store/endpoints/admin-leads";

import { LeadStatusBadge, NewLeadMarker } from "./lead-status";

/**
 * The list refetches every 15 seconds while the tab is in front and when it
 * comes back, so a new lead appears without a reload. A refetch of the same
 * view does not dim the table; only a new filter or page does.
 */
function useLeadList(params: AdminLeadListParams) {
  const result = useAdminLeadsQuery(params, {
    pollingInterval: 15_000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  return { ...result, isFetching: result.isFetching && result.currentData === undefined };
}

const columns: ColumnDef<AdminLead>[] = [
  {
    id: "name",
    meta: { label: t("leads.name"), sortField: "name", primary: true },
    cell: ({ row }) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Link
          href={`${leadsHref}/${row.original.id}`}
          className="inline-flex min-h-(--spacing-target) items-center font-medium underline underline-offset-4 md:min-h-0"
        >
          {row.original.name}
        </Link>
        {row.original.status === "new" ? <NewLeadMarker /> : null}
      </span>
    ),
  },
  {
    id: "type",
    meta: { label: t("leads.type") },
    cell: ({ row }) => t(`leadType.${row.original.type}`),
  },
  {
    id: "status",
    meta: { label: t("leads.status"), sortField: "status" },
    cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
  },
  {
    id: "phone",
    meta: { label: t("leads.phone") },
    cell: ({ row }) =>
      row.original.phone ? (
        <a
          href={leadTelHref(row.original.phone)}
          className="whitespace-nowrap underline-offset-4 hover:underline"
        >
          {formatPhone(row.original.phone)}
        </a>
      ) : (
        <span className="text-muted-foreground">{t("leads.anonymised")}</span>
      ),
  },
  {
    id: "apartment",
    meta: { label: t("leads.apartment") },
    cell: ({ row }) => row.original.apartment?.label ?? "",
  },
  {
    id: "source",
    meta: { label: t("leads.source") },
    cell: ({ row }) => <span className="break-all">{row.original.source}</span>,
  },
  {
    id: "assignee",
    meta: { label: t("leads.assignee") },
    cell: ({ row }) =>
      row.original.assignee?.name ?? (
        <span className="text-muted-foreground">{t("leads.unassigned")}</span>
      ),
  },
  {
    id: "createdAt",
    meta: { label: t("leads.createdAt"), sortField: "createdAt", align: "end" },
    cell: ({ row }) => (
      <time dateTime={row.original.createdAt} className="whitespace-nowrap">
        {adminDateTime(row.original.createdAt)}
      </time>
    ),
  },
];

export type LeadsTableOptions = {
  sources: string[];
  apartments: Array<{ slug: string; label: string }>;
  /** Empty for a user who works only their own and unassigned leads. */
  assignees: LeadUser[];
};

/**
 * The leads list (#26): the pipeline at a glance, new leads marked, filters
 * in the URL. A user without `leads:assign` gets only their own and
 * unassigned leads from the API.
 */
export function LeadsTable({ sources, apartments, assignees }: LeadsTableOptions) {
  const filters = useMemo<DataTableAnyFilter[]>(
    () =>
      (
        [
          {
            key: leadFilterKeys.status,
            label: t("leads.status"),
            options: leadStatuses.map((status) => ({
              value: status,
              label: t(`leadStatus.${status}`),
            })),
          },
          {
            key: leadFilterKeys.type,
            label: t("leads.type"),
            options: leadTypes.map((type) => ({ value: type, label: t(`leadType.${type}`) })),
          },
          {
            key: leadFilterKeys.source,
            label: t("leads.source"),
            options: sources.map((source) => ({ value: source, label: source })),
          },
          {
            key: leadFilterKeys.apartment,
            label: t("leads.apartment"),
            options: apartments.map(({ slug, label }) => ({ value: slug, label })),
          },
          {
            key: leadFilterKeys.assignee,
            label: t("leads.assignee"),
            options: [
              ...assigneeKeywords.map((keyword) => ({
                value: keyword,
                label: t(`leads.assignee.${keyword}`),
              })),
              ...assignees.map((user) => ({ value: user.id, label: user.name })),
            ],
          },
          { key: leadFilterKeys.from, label: t("leads.from"), kind: "date" },
          { key: leadFilterKeys.to, label: t("leads.to"), kind: "date" },
        ] satisfies DataTableAnyFilter[]
      ).filter((filter: DataTableAnyFilter) => isDateFilter(filter) || filter.options.length > 0),
    [sources, apartments, assignees],
  );

  return (
    <DataTable<AdminLead, AdminLeadListParams>
      caption={t("leads.caption")}
      columns={columns}
      defaultSort="-createdAt"
      sortFields={["updatedAt"]}
      filters={filters}
      useList={useLeadList}
      toParams={leadListParams}
      getRowId={(item) => item.id}
      rowClassName={(item) => (item.status === "new" ? "bg-secondary" : undefined)}
    />
  );
}
