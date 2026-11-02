import type { Metadata } from "next";
import { connection } from "next/server";

import { ComplexForm } from "@/components/admin/settings/complex-form";
import { SectionHeader } from "@/components/admin/settings/section-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getSetting } from "@/lib/admin/settings";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: `${t("settings.nav.complex")} · ${t("nav.settings")}` };

export const instant = false;

export default async function ComplexSettingsPage() {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const { value } = await getSetting(getDb(), "complex");
  return (
    <>
      <SectionHeader title="settings.nav.complex" lead="settings.complex.lead" />
      <ComplexForm initial={value} readOnly={!can(user.role, { settings: ["update"] })} />
    </>
  );
}
