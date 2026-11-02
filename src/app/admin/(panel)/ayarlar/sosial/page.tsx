import type { Metadata } from "next";
import { connection } from "next/server";

import { SectionHeader } from "@/components/admin/settings/section-header";
import { SocialsForm } from "@/components/admin/settings/socials-form";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getSetting } from "@/lib/admin/settings";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: `${t("settings.nav.socials")} · ${t("nav.settings")}` };

export const instant = false;

export default async function SocialsSettingsPage() {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const { value } = await getSetting(getDb(), "socials");
  return (
    <>
      <SectionHeader title="settings.nav.socials" lead="settings.socials.lead" />
      <SocialsForm initial={value} readOnly={!can(user.role, { settings: ["update"] })} />
    </>
  );
}
