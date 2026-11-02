"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";

import { DataTable, type ListResult } from "@/components/admin/data-table/data-table";
import { Button } from "@/components/admin/ui/button";
import { adminArea } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import type { AdminLayoutType } from "@/shared/inventory";
import { useAdminLayoutTypesQuery } from "@/store/endpoints/admin-inventory";

import { inventoryPages } from "./inventory-nav";

const base = inventoryPages.layouts.href;

const columns: ColumnDef<AdminLayoutType>[] = [
  {
    id: "code",
    meta: { label: t("layouts.code"), primary: true },
    cell: ({ row }) => row.original.code,
  },
  {
    id: "rooms",
    meta: { label: t("layouts.rooms"), align: "end" },
    cell: ({ row }) => row.original.rooms,
  },
  {
    id: "area",
    meta: { label: t("layouts.area"), align: "end" },
    cell: ({ row }) => adminArea(row.original.areaTotal),
  },
  {
    id: "plan",
    meta: { label: t("layouts.plan") },
    cell: ({ row }) =>
      row.original.plan ? (
        (row.original.plan.alt ?? t("picker.untitled"))
      ) : (
        <span className="text-muted-foreground">{t("layouts.noPlan")}</span>
      ),
  },
  {
    id: "apartments",
    meta: { label: t("layouts.apartments"), align: "end" },
    cell: ({ row }) => row.original.apartments,
  },
  {
    id: "actions",
    meta: { label: t("apartments.actions"), align: "end" },
    cell: ({ row }) => (
      <Button asChild variant="ghost" size="icon">
        <Link
          href={`${base}/${row.original.id}`}
          aria-label={t("apartments.editLabel", { name: row.original.code })}
        >
          <Pencil aria-hidden />
        </Link>
      </Button>
    ),
  },
];

/** The layout types are few and unpaginated; the table shows them as one page. */
function useLayoutList(): ListResult<AdminLayoutType> {
  const result = useAdminLayoutTypesQuery();
  const items = result.data;
  return {
    ...result,
    data: items && {
      items,
      page: 1,
      pageSize: items.length,
      total: items.length,
      pageCount: 1,
    },
  };
}

export function LayoutsTable({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {canCreate ? (
        <div>
          <Button asChild>
            <Link href={`${base}/yeni`}>
              <Plus aria-hidden />
              {t("layouts.new")}
            </Link>
          </Button>
        </div>
      ) : null}
      <DataTable<AdminLayoutType, void>
        caption={t("layouts.caption")}
        columns={columns}
        defaultSort="code"
        useList={useLayoutList}
        toParams={() => undefined}
        getRowId={(item) => item.id}
      />
    </div>
  );
}
