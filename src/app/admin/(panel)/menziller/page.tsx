import type { Metadata } from "next";
import { connection } from "next/server";

import { ApartmentsTable } from "@/components/admin/apartments/apartments-table";
import { importPermission, InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { apartmentFilterOptions } from "@/lib/admin/apartments";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.apartments") };

export const instant = false;

/** The inventory module's list (#24): filters, row selection and bulk actions. */
export default async function ApartmentsPage() {
  const user = await requireUser(adminModules.apartments.permission);
  await connection();
  const { blocks, floors, rooms } = await apartmentFilterOptions(getDb());
  return (
    <>
      <PageHeader title={t("nav.apartments")} description={t("module.apartments")} />
      <InventoryNav current="apartments" canImport={can(user.role, importPermission)} />
      <ApartmentsTable
        blocks={blocks}
        floors={floors}
        rooms={rooms}
        abilities={{
          create: can(user.role, { inventory: ["create"] }),
          update: can(user.role, { inventory: ["update"] }),
          status: can(user.role, { apartmentStatus: ["update"] }),
        }}
      />
    </>
  );
}
