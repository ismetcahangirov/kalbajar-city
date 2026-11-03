import type { Metadata } from "next";

import { ContentNav } from "@/components/admin/content/content-nav";
import { ModuleComing } from "@/components/admin/shell/module-coming";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.news") };

export const instant = false;

// The news editor arrives later in #25; the gallery and FAQ are already in the content nav.
export default async function NewsPage() {
  await requireUser(adminModules.news.permission);
  return (
    <>
      <ModuleComing title={t("nav.news")} description={t("module.news")} />
      <ContentNav current="news" />
    </>
  );
}
