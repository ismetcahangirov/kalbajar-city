import type { Metadata } from "next";
import { connection } from "next/server";

import { PricesForm } from "@/components/admin/settings/prices-form";
import { SectionHeader } from "@/components/admin/settings/section-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getSetting } from "@/lib/admin/settings";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: `${t("settings.nav.prices")} · ${t("nav.settings")}` };

export const instant = false;

export default async function PricesSettingsPage() {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const { value } = await getSetting(getDb(), "prices");
  return (
    <>
      <SectionHeader title="settings.nav.prices" lead="settings.prices.lead" />
      <PricesForm initial={value} readOnly={!can(user.role, { settings: ["update"] })} />
    </>
  );
}
