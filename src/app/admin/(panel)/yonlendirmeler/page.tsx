import type { Metadata } from "next";

import { RedirectsManager } from "@/components/admin/redirects/redirects-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.redirects") };

export const instant = false;

/** Redirects served by the proxy without a deploy (#27). */
export default async function RedirectsPage() {
  const user = await requireUser(adminModules.redirects.permission);
  return (
    <>
      <PageHeader title={t("nav.redirects")} description={t("redirects.lead")} />
      <RedirectsManager canEdit={can(user.role, { seo: ["update"] })} />
    </>
  );
}
