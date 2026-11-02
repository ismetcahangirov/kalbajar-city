import type { Metadata } from "next";
import { connection } from "next/server";

import { ApartmentsTable } from "@/components/admin/apartments/apartments-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { apartmentFilterOptions } from "@/lib/admin/apartments";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.apartments") };

export const instant = false;

/** The inventory module's list; editing arrives with #24. */
export default async function ApartmentsPage() {
  await requireUser(adminModules.apartments.permission);
  await connection();
  const { blocks, rooms } = await apartmentFilterOptions(getDb());
  return (
    <>
      <PageHeader title={t("nav.apartments")} description={t("module.apartments")} />
      <ApartmentsTable blocks={blocks} rooms={rooms} />
    </>
  );
}
