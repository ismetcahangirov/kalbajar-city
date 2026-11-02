import type { Metadata } from "next";
import { connection } from "next/server";

import { ContactsForm } from "@/components/admin/settings/contacts-form";
import { SectionHeader } from "@/components/admin/settings/section-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getSetting } from "@/lib/admin/settings";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: `${t("settings.nav.contacts")} · ${t("nav.settings")}` };

export const instant = false;

/** The settings screen's first section: the contacts every page shows. */
export default async function ContactsSettingsPage() {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const { value } = await getSetting(getDb(), "contacts");
  return (
    <>
      <SectionHeader title="settings.nav.contacts" lead="settings.contacts.lead" />
      <ContactsForm initial={value} readOnly={!can(user.role, { settings: ["update"] })} />
    </>
  );
}
