import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { NewsForm } from "@/components/admin/content/news-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getNews } from "@/lib/admin/news";
import { HttpError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { contentIdParamsSchema } from "@/shared/content";

export const metadata: Metadata = { title: t("news.editTitle") };

export const instant = false;

/** One article; read-only for roles that may not change content. */
export default async function NewsArticlePage({ params }: PageProps<"/admin/xeberler/[id]">) {
  const user = await requireUser(adminModules.news.permission);
  const parsed = contentIdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  await connection();
  const item = await getNews(getDb(), parsed.data.id).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader title={t("news.editTitle")} description={item.title.az} />
      <NewsForm
        item={item}
        abilities={{
          update: can(user.role, { content: ["update"] }),
          delete: can(user.role, { content: ["delete"] }),
          publish: can(user.role, { content: ["publish"] }),
          upload: can(user.role, { media: ["upload"] }),
        }}
      />
    </>
  );
}
