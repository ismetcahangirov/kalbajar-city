import type { Metadata } from "next";

import { CsvImport } from "@/components/admin/inventory/csv-import";
import { importPermission, InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("import.title") };

export const instant = false;

/** The apartments CSV import, with a validation preview and a dry run. */
export default async function ImportPage() {
  await requireUser(importPermission);
  return (
    <>
      <PageHeader title={t("import.title")} description={t("import.lead")} />
      <InventoryNav current="import" canImport />
      <CsvImport />
    </>
  );
}
