import type { Metadata } from "next";
import { connection } from "next/server";

import { LeadSettingsForm } from "@/components/admin/leads/lead-settings-form";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { requireUser } from "@/lib/auth/session";
import { leadSettings } from "@/lib/leads/settings";

export const metadata: Metadata = { title: t("leads.settings.title") };

export const instant = false;

/** The leads module's settings (owner and admin): e-mail recipients and retention. */
export default async function LeadSettingsPage() {
  await requireUser({ settings: ["update"] });
  await connection();
  const settings = await leadSettings(getDb());
  return (
    <>
      <PageHeader title={t("leads.settings.title")} description={t("leads.settings.lead")} />
      <LeadSettingsForm initial={settings} />
    </>
  );
}
