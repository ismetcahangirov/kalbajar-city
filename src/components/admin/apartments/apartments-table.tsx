"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Download, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { adminArea, adminDateTime, adminMoney } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { sortKey } from "@/lib/admin/table-state";
import type { AdminApartment, AdminApartmentListParams } from "@/shared/apartments";
import { apartmentStatuses, type ApartmentStatus } from "@/shared/inventory";
import { useAdminApartmentsQuery } from "@/store/endpoints/admin-apartments";

import { BulkBar } from "./bulk-bar";

const base = adminModules.apartments.href;

export const apartmentName = (apartment: Pick<AdminApartment, "block" | "number">) =>
  `${apartment.block}-${apartment.number}`;

const columns: ColumnDef<AdminApartment>[] = [
  {
    id: "number",
    meta: { label: t("apartments.number"), sortField: "number", primary: true },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-2">
        {apartmentName(row.original)}
        {row.original.isDemo ? (
          <Badge variant="outline" title={t("apartments.demoHint")}>
            {t("apartments.demo")}
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    id: "floor",
    meta: { label: t("apartments.floor"), sortField: "floor", align: "end" },
    cell: ({ row }) => row.original.floor,
  },
  {
    id: "layout",
    meta: { label: t("apartments.layout") },
    cell: ({ row }) => row.original.layout.code,
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
  {
    id: "actions",
    meta: { label: t("apartments.actions"), align: "end" },
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="icon">
        <Link
          href={`${base}/${row.original.id}`}
          aria-label={t("apartments.editLabel", { name: apartmentName(row.original) })}
        >
          <Pencil aria-hidden />
        </Link>
      </Button>
    ),
  },
];

/** The list's URL keys and the API's names for them; the export takes the same filters. */
const exportKeys = { status: "status", blok: "block", otaq: "rooms", mertebe: "floor" } as const;

function exportHref(search: URLSearchParams): string {
  const params = new URLSearchParams();
  for (const [key, apiKey] of Object.entries(exportKeys)) {
    const value = search.get(key);
    if (value) params.set(apiKey, value);
  }
  const sort = search.get(sortKey);
  if (sort) params.set("sort", sort);
  const query = params.toString();
  return `/api/v1/admin/apartments/export.csv${query ? `?${query}` : ""}`;
}

export type InventoryAbilities = {
  /** `inventory:create`: add apartments. */
  create: boolean;
  /** `inventory:update`: prices, layouts and everything but the status. */
  update: boolean;
  /** `apartmentStatus:update`: statuses, publishing included (sales has it). */
  status: boolean;
};

/**
 * The inventory list: every apartment in any status, filtered by status,
 * block, floor and rooms through the URL, with row selection for the bulk
 * actions the user's role allows.
 */
export function ApartmentsTable({
  blocks,
  floors,
  rooms,
  abilities,
}: {
  blocks: string[];
  floors: number[];
  rooms: number[];
  abilities: InventoryAbilities;
}) {
  const search = useSearchParams();
  const [selected, setSelected] = useState<Map<string, AdminApartment>>(new Map());

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {abilities.create ? (
          <Button asChild>
            <Link href={`${base}/yeni`}>
              <Plus aria-hidden />
              {t("apartments.new")}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a
            href={exportHref(new URLSearchParams(search.toString()))}
            download
            title={t("apartments.exportHint")}
          >
            <Download aria-hidden />
            {t("apartments.export")}
          </a>
        </Button>
      </div>

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
            key: "mertebe",
            label: t("apartments.floor"),
            options: floors.map((floor) => ({
              value: String(floor),
              label: t("apartments.floorValue", { floor }),
            })),
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
          floor: filters.mertebe?.map(Number),
          rooms: filters.otaq?.map(Number),
        })}
        getRowId={(item) => item.id}
        selection={
          abilities.status ? { selected, onChange: setSelected, label: apartmentName } : undefined
        }
      />

      {abilities.status && selected.size ? (
        <BulkBar
          selected={selected}
          canPrice={abilities.update}
          onClear={() => setSelected(new Map())}
        />
      ) : null}
    </div>
  );
}
