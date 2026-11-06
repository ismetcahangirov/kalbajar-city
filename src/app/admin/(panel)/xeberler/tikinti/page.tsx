import type { Metadata } from "next";

import { ConstructionList } from "@/components/admin/content/construction-list";
import { ContentNav } from "@/components/admin/content/content-nav";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("construction.title") };

export const instant = false;

/** The construction updates: drafts, scheduled and published (#25). */
export default async function ConstructionPage() {
  const user = await requireUser(adminModules.news.permission);
  return (
    <>
      <PageHeader title={t("construction.title")} description={t("construction.lead")} />
      <ContentNav current="construction" />
      <ConstructionList canCreate={can(user.role, { content: ["create"] })} />
    </>
  );
}
