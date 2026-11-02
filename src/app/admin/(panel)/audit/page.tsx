import type { Metadata } from "next";

import { ModuleComing } from "@/components/admin/shell/module-coming";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.audit") };

export const instant = false;

// The module arrives with its own issue; until then the menu link opens this.
export default async function AuditPage() {
  await requireUser(adminModules.audit.permission);
  return <ModuleComing title={t("nav.audit")} description={t("module.audit")} />;
}
