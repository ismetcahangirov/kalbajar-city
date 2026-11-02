import type { Metadata } from "next";

import { importPermission, InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { LayoutsTable } from "@/components/admin/inventory/layouts-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("layouts.title") };

export const instant = false;

/** The layout types: rooms, area, breakdown and plan image. */
export default async function LayoutsPage() {
  const user = await requireUser(adminModules.apartments.permission);
  return (
    <>
      <PageHeader title={t("layouts.title")} description={t("layouts.lead")} />
      <InventoryNav current="layouts" canImport={can(user.role, importPermission)} />
      <LayoutsTable canCreate={can(user.role, { inventory: ["create"] })} />
    </>
  );
}
