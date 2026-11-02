import { Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { LeadsExportLink } from "@/components/admin/leads/export-link";
import { LeadsTable } from "@/components/admin/leads/leads-table";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/admin/ui/button";
import { getDb } from "@/db";
import { leadFilterOptions } from "@/lib/admin/leads";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: t("nav.leads") };

export const instant = false;

/**
 * The leads module (#26): every lead the user may work, newest first, with
 * the CSV export for owner and admin and a link to the module's settings.
 */
export default async function LeadsPage() {
  const user = await requireUser(adminModules.leads.permission);
  await connection();
  const options = await leadFilterOptions(getDb(), user);
  const canExport = can(user.role, { leads: ["export"] });
  const canConfigure = can(user.role, { settings: ["update"] });

  return (
    <>
      <PageHeader
        title={t("nav.leads")}
        description={t(can(user.role, { leads: ["assign"] }) ? "module.leads" : "leads.scopeOwn")}
        actions={
          canExport || canConfigure ? (
            <div className="flex flex-wrap gap-2">
              {canExport ? <LeadsExportLink /> : null}
              {canConfigure ? (
                <Button asChild variant="outline">
                  <Link href="/admin/muracietler/ayarlar">
                    <Settings aria-hidden />
                    {t("leads.settings.title")}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />
      <LeadsTable {...options} />
    </>
  );
}
