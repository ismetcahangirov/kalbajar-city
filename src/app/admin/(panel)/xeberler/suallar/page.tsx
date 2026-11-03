import type { Metadata } from "next";

import { ContentNav } from "@/components/admin/content/content-nav";
import { FaqManager } from "@/components/admin/content/faq-manager";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("faq.title") };

export const instant = false;

/** The FAQ: questions, answers and their order on the site (#25). */
export default async function FaqPage() {
  const user = await requireUser(adminModules.news.permission);
  return (
    <>
      <PageHeader title={t("faq.title")} description={t("faq.lead")} />
      <ContentNav current="faq" />
      <FaqManager
        abilities={{
          create: can(user.role, { content: ["create"] }),
          update: can(user.role, { content: ["update"] }),
          delete: can(user.role, { content: ["delete"] }),
          publish: can(user.role, { content: ["publish"] }),
        }}
      />
    </>
  );
}
