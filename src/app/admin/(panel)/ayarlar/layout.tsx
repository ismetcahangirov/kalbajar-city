import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { PlaceholdersProvider } from "@/components/admin/settings/placeholders";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getDb } from "@/db";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { getPlaceholders } from "@/lib/admin/placeholders";
import { leadSettingsHref } from "@/lib/admin/settings-sections";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const instant = false;

/**
 * The settings screen (#27): a section nav and one form per section, each
 * saved on its own. Stand-in values are flagged until someone saves a real
 * value or confirms them.
 */
export default async function SettingsLayout({ children }: LayoutProps<"/admin/ayarlar">) {
  const user = await requireUser(adminModules.settings.permission);
  await connection();
  const placeholders = await getPlaceholders(getDb());
  const canUpdate = can(user.role, { settings: ["update"] });

  return (
    <PlaceholdersProvider
      initial={placeholders}
      abilities={{ settings: canUpdate, content: can(user.role, { content: ["update"] }) }}
    >
      <PageHeader title={t("nav.settings")} description={t("settings.lead")} />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <SettingsNav />
        <div className="flex max-w-3xl min-w-0 flex-col gap-6">
          {children}
          {canUpdate ? (
            <Link
              href={leadSettingsHref}
              className="bg-card flex min-h-(--spacing-target) items-center justify-between gap-4 rounded-lg border p-4 hover:bg-accent"
            >
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">{t("leads.settings.title")}</span>
                <span className="text-sm text-muted-foreground">{t("settings.leadsCard")}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
          ) : null}
        </div>
      </div>
    </PlaceholdersProvider>
  );
}
