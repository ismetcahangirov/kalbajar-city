import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { LayoutForm } from "@/components/admin/inventory/layout-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { getLayoutType } from "@/lib/admin/inventory";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { HttpError } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { inventoryIdParamsSchema } from "@/shared/inventory";

export const metadata: Metadata = { title: t("layouts.title") };

export const instant = false;

/** One layout type; read-only for roles that may not change the inventory. */
export default async function LayoutPage({ params }: PageProps<"/admin/menziller/planlar/[id]">) {
  const user = await requireUser(adminModules.apartments.permission);
  const parsed = inventoryIdParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  await connection();
  const layout = await getLayoutType(getDb(), parsed.data.id).catch((error: unknown) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader title={t("layouts.editTitle", { code: layout.code })} />
      <LayoutForm
        layout={layout}
        abilities={{
          update: can(user.role, { inventory: ["update"] }),
          delete: can(user.role, { inventory: ["delete"] }),
        }}
      />
    </>
  );
}
