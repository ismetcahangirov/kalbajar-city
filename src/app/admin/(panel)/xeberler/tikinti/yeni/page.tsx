import type { Metadata } from "next";

import { ConstructionForm } from "@/components/admin/content/construction-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("construction.newTitle") };

export const instant = false;

/** A new construction update, created as a draft. */
export default async function NewConstructionUpdatePage() {
  const user = await requireUser({ content: ["create"] });
  return (
    <>
      <PageHeader title={t("construction.newTitle")} />
      <ConstructionForm
        abilities={{
          update: true,
          delete: false,
          publish: false,
          upload: can(user.role, { media: ["upload"] }),
          updateMedia: can(user.role, { media: ["update"] }),
        }}
      />
    </>
  );
}
