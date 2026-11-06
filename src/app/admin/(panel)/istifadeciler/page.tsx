import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/shell/page-header";
import { UsersManager } from "@/components/admin/users/users-manager";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.users") };

export const instant = false;

/** Console accounts: invite by e-mail, set a role, deactivate (#27). */
export default async function UsersPage() {
  const user = await requireUser(adminModules.users.permission);
  return (
    <>
      <PageHeader title={t("nav.users")} description={t("users.lead")} />
      <UsersManager canGrantOwner={user.role === "owner"} />
    </>
  );
}
