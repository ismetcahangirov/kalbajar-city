import type { Metadata } from "next";

import { importPermission, InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { SelectorEditor } from "@/components/admin/inventory/selector-editor";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("selector.title") };

export const instant = false;

/** The complex selector's pictures and the hotspots drawn on them (#19). */
export default async function SelectorPage() {
  const user = await requireUser(adminModules.apartments.permission);
  return (
    <>
      <PageHeader title={t("selector.title")} description={t("selector.lead")} />
      <InventoryNav current="selector" canImport={can(user.role, importPermission)} />
      <SelectorEditor canEdit={can(user.role, { inventory: ["update"] })} />
    </>
  );
}
