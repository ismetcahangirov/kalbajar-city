import type { Metadata } from "next";

import { ModuleComing } from "@/components/admin/shell/module-coming";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.users") };

export const instant = false;

// The module arrives with its own issue; until then the menu link opens this.
export default async function UsersPage() {
  await requireUser(adminModules.users.permission);
  return <ModuleComing title={t("nav.users")} description={t("module.users")} />;
}
