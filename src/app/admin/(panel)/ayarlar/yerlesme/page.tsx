import type { Metadata } from "next";
import { connection } from "next/server";

import { LocationForm } from "@/components/admin/settings/location-form";
import { SectionHeader } from "@/components/admin/settings/section-header";
import { getDb } from "@/db";
import { getHomeSection } from "@/lib/admin/home-sections";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: `${t("settings.nav.location")} · ${t("nav.settings")}`,
};

export const instant = false;

/**
 * The home page's location section, edited here with the contacts it
 * belongs with; saving it needs `content:update`, like any home section.
 */
export default async function LocationSettingsPage() {
  const user = await requireUser({ ...adminModules.settings.permission, content: ["read"] });
  await connection();
  const { content } = await getHomeSection(getDb(), "location");
  return (
    <>
      <SectionHeader title="settings.nav.location" lead="settings.location.lead" />
      <LocationForm
        initial={content}
        readOnly={!can(user.role, { content: ["update"] })}
        canUpload={can(user.role, { media: ["upload"] })}
      />
    </>
  );
}
