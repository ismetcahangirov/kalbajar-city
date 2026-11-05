import type { Metadata } from "next";

import { SeoManager } from "@/components/admin/seo/seo-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { siteOrigin } from "@/lib/seo/url";

export const metadata: Metadata = { title: t("nav.seo") };

export const instant = false;

/** Per-page title, description, share image and noindex overrides (#27). */
export default async function SeoPage() {
  const user = await requireUser(adminModules.seo.permission);
  return (
    <>
      <PageHeader title={t("nav.seo")} description={t("seo.lead")} />
      <SeoManager
        canEdit={can(user.role, { seo: ["update"] })}
        canUpload={can(user.role, { media: ["upload"] })}
        origin={siteOrigin()}
      />
    </>
  );
}
