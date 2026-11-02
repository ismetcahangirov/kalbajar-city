import type { Metadata } from "next";

import { importPermission, InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { Structure } from "@/components/admin/inventory/structure";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("structure.title") };

export const instant = false;

/** Buildings, blocks and floors. */
export default async function StructurePage() {
  const user = await requireUser(adminModules.apartments.permission);
  return (
    <>
      <PageHeader title={t("structure.title")} description={t("structure.lead")} />
      <InventoryNav current="structure" canImport={can(user.role, importPermission)} />
      <Structure
        abilities={{
          create: can(user.role, { inventory: ["create"] }),
          update: can(user.role, { inventory: ["update"] }),
          delete: can(user.role, { inventory: ["delete"] }),
        }}
      />
    </>
  );
}
