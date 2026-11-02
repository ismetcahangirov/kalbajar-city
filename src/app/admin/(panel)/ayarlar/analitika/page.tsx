import type { Metadata } from "next";
import { connection } from "next/server";

import { AnalyticsForm } from "@/components/admin/settings/analytics-form";
import { SectionHeader } from "@/components/admin/settings/section-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getSetting } from "@/lib/admin/settings";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `${t("settings.nav.analytics")} · ${t("nav.settings")}`,
};

export const instant = false;

export default async function AnalyticsSettingsPage() {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const { value } = await getSetting(getDb(), "analytics");
  return (
    <>
      <SectionHeader title="settings.nav.analytics" lead="settings.analytics.lead" />
      <AnalyticsForm initial={value} readOnly={!can(user.role, { settings: ["update"] })} />
    </>
  );
}
