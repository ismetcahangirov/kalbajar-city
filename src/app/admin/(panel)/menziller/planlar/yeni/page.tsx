import type { Metadata } from "next";

import { LayoutForm } from "@/components/admin/inventory/layout-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { t } from "@/lib/admin/messages";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("layouts.newTitle") };

export const instant = false;

export default async function NewLayoutPage() {
  await requireUser({ inventory: ["create"] });
  return (
    <>
      <PageHeader title={t("layouts.newTitle")} />
      <LayoutForm abilities={{ update: true, delete: false }} />
    </>
  );
}
