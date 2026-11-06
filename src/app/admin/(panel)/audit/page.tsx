import type { Metadata } from "next";
import { connection } from "next/server";

import { AuditLog } from "@/components/admin/audit/audit-log";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { auditFilterOptions } from "@/lib/admin/audit-log";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.audit") };

export const instant = false;

/** The audit log viewer (#27). Read-only, by design: rows are only ever inserted. */
export default async function AuditPage() {
  await requireUser(adminModules.audit.permission);
  await connection();
  const options = await auditFilterOptions(getDb());
  return (
    <>
      <PageHeader title={t("nav.audit")} description={t("module.audit")} />
      <AuditLog {...options} />
    </>
  );
}
