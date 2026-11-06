import type { Metadata } from "next";

import { NewsForm } from "@/components/admin/content/news-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("news.newTitle") };

export const instant = false;

/** A new article, created as a draft. */
export default async function NewNewsPage() {
  const user = await requireUser({ content: ["create"] });
  return (
    <>
      <PageHeader title={t("news.newTitle")} />
      <NewsForm
        abilities={{
          update: true,
          delete: false,
          publish: false,
          upload: can(user.role, { media: ["upload"] }),
        }}
      />
    </>
  );
}
