"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/admin/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/admin/ui/badge";
import { adminArea, adminDateTime, adminMoney } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import type { AdminApartment, AdminApartmentListParams } from "@/shared/apartments";
import { apartmentStatuses, type ApartmentStatus } from "@/shared/inventory";
import { useAdminApartmentsQuery } from "@/store/endpoints/admin-apartments";

const columns: ColumnDef<AdminApartment>[] = [
  {
    id: "number",
    meta: { label: t("apartments.number"), sortField: "number", primary: true },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2">
        {row.original.block}-{row.original.number}
        {row.original.isDemo ? (
          <Badge variant="outline" title={t("apartments.demoHint")}>
            {t("apartments.demo")}
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    id: "block",
    meta: { label: t("apartments.block") },
    cell: ({ row }) => row.original.block,
  },
  {
    id: "floor",
    meta: { label: t("apartments.floor"), sortField: "floor", align: "end" },
    cell: ({ row }) => row.original.floor,
  },
  {
    id: "rooms",
    meta: { label: t("apartments.rooms"), align: "end" },
    cell: ({ row }) => row.original.layout.rooms,
  },
  {
    id: "area",
    meta: { label: t("apartments.area"), sortField: "area", align: "end" },
    cell: ({ row }) => adminArea(row.original.areaTotal),
  },
  {
    id: "price",
    meta: { label: t("apartments.price"), sortField: "price", align: "end" },
    cell: ({ row }) =>
      row.original.priceMinor === null ? (
        <span className="text-muted-foreground">{t("apartments.noPrice")}</span>
      ) : (
        adminMoney(row.original.priceMinor, row.original.currency)
      ),
  },
  {
    id: "status",
    meta: { label: t("apartments.status") },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "updatedAt",
    meta: { label: t("apartments.updatedAt"), sortField: "updatedAt", align: "end" },
    cell: ({ row }) => adminDateTime(row.original.updatedAt),
  },
];

/**
 * The inventory list (read-only until #24 adds editing): every apartment in
 * any status, filtered by status, block and rooms through the URL.
 */
export function ApartmentsTable({ blocks, rooms }: { blocks: string[]; rooms: number[] }) {
  return (
    <DataTable<AdminApartment, AdminApartmentListParams>
      caption={t("apartments.caption")}
      columns={columns}
      defaultSort="number"
      filters={[
        {
          key: "status",
          label: t("apartments.status"),
          options: apartmentStatuses.map((status) => ({
            value: status,
            label: t(`status.${status}`),
          })),
        },
        {
          key: "blok",
          label: t("apartments.block"),
          options: blocks.map((code) => ({ value: code, label: code })),
        },
        {
          key: "otaq",
          label: t("apartments.rooms"),
          options: rooms.map((count) => ({
            value: String(count),
            label: t("apartments.roomsValue", { rooms: count }),
          })),
        },
      ]}
      useList={useAdminApartmentsQuery}
      toParams={({ page, pageSize, sort, filters }): AdminApartmentListParams => ({
        page,
        pageSize,
        sort: sort as AdminApartmentListParams["sort"],
        status: filters.status as ApartmentStatus[] | undefined,
        block: filters.blok,
        rooms: filters.otaq?.map(Number),
      })}
      getRowId={(item) => item.id}
    />
  );
}
