import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ConstructionForm } from "@/components/admin/content/construction-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { getConstructionUpdate } from "@/lib/admin/construction";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { HttpError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { contentIdParamsSchema } from "@/shared/content";

export const metadata: Metadata = { title: t("construction.editTitle") };

export const instant = false;

/** One construction update; read-only for roles that may not change content. */
export default async function ConstructionUpdatePage({
  params,
}: PageProps<"/admin/xeberler/tikinti/[id]">) {
  const user = await requireUser(adminModules.news.permission);
  const parsed = contentIdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  await connection();
  const item = await getConstructionUpdate(getDb(), parsed.data.id).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader title={t("construction.editTitle")} description={item.title.az} />
      <ConstructionForm
        item={item}
        abilities={{
          update: can(user.role, { content: ["update"] }),
          delete: can(user.role, { content: ["delete"] }),
          publish: can(user.role, { content: ["publish"] }),
          upload: can(user.role, { media: ["upload"] }),
          updateMedia: can(user.role, { media: ["update"] }),
        }}
      />
    </>
  );
}
