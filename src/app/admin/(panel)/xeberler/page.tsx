import type { Metadata } from "next";

import { ContentNav } from "@/components/admin/content/content-nav";
import { NewsList } from "@/components/admin/content/news-list";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.news") };

export const instant = false;

/** The articles: drafts, scheduled and published (#25). */
export default async function NewsPage() {
  const user = await requireUser(adminModules.news.permission);
  return (
    <>
      <PageHeader title={t("news.title")} description={t("news.lead")} />
      <ContentNav current="news" />
      <NewsList canCreate={can(user.role, { content: ["create"] })} />
    </>
  );
}
