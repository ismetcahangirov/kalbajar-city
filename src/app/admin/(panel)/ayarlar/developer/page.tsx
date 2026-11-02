import type { Metadata } from "next";
import { connection } from "next/server";

import { DeveloperForm } from "@/components/admin/settings/developer-form";
import { SectionHeader } from "@/components/admin/settings/section-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getSetting } from "@/lib/admin/settings";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `${t("settings.nav.developer")} · ${t("nav.settings")}`,
};

export const instant = false;

export default async function DeveloperSettingsPage() {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const { value } = await getSetting(getDb(), "developer");
  return (
    <>
      <SectionHeader title="settings.nav.developer" lead="settings.developer.lead" />
      <DeveloperForm
        initial={value}
        readOnly={!can(user.role, { settings: ["update"] })}
        canUpload={can(user.role, { media: ["upload"] })}
      />
    </>
  );
}
