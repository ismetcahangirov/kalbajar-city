import { ArrowRight, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { getDb } from "@/db";
import {
  apartmentsByStatus,
  leadsThisWeek,
  missingTranslationCount,
  recentActivity,
} from "@/lib/admin/dashboard";
import { adminDateTime } from "@/lib/admin/format";
import { canOpen } from "@/lib/admin/menu";
import { isMessageKey, t } from "@/lib/admin/messages";
import { adminModules, type AdminModule } from "@/lib/admin/navigation";
import { getPlaceholders } from "@/lib/admin/placeholders";
import { placeholderLabel, sectionOfPath } from "@/lib/admin/settings-sections";
import { requireUser } from "@/lib/auth/session";
import { apartmentStatuses } from "@/shared/inventory";
import { leadStatuses, leadTypes } from "@/shared/leads";

export const metadata: Metadata = { title: t("dashboard.title") };

export const instant = false;

/**
 * The console home (#23): the stand-in values still waiting for the owner
 * (#27), this week's leads, the inventory by status, the translations still
 * missing and the latest changes, each card shown only to roles that may open
 * its module.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  await connection();
  const db = getDb();

  const show = {
    leads: canOpen(user.role, "leads"),
    apartments: canOpen(user.role, "apartments"),
    translations: canOpen(user.role, "news"),
    activity: canOpen(user.role, "audit"),
    placeholders: canOpen(user.role, "settings"),
  };
  const [placeholders, leads, inventory, translations, activity] = await Promise.all([
    show.placeholders ? getPlaceholders(db) : null,
    show.leads ? leadsThisWeek(db) : null,
    show.apartments ? apartmentsByStatus(db) : null,
    show.translations ? missingTranslationCount(db) : null,
    show.activity ? recentActivity(db, 10) : null,
  ]);

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.welcome", { name: user.name })}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {placeholders?.length ? (
          <DashboardCard
            title={t("dashboard.placeholders", { count: placeholders.length })}
            module="settings"
          >
            <p className="text-sm inline-flex items-start gap-1.5">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-text-accent" />
              {t("dashboard.placeholdersLead")}
            </p>
            <ul className="text-sm flex flex-col" data-placeholders="">
              {placeholders.map((path) => (
                <li key={path}>
                  <Link
                    href={sectionOfPath(path)?.href ?? adminModules.settings.href}
                    className="inline-flex min-h-(--spacing-target) items-center underline underline-offset-4"
                  >
                    {placeholderLabel(path)}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
        ) : null}

        {leads ? (
          <DashboardCard title={t("dashboard.leads")} module="leads">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.leadsTotal", { total: leads.total })}
            </p>
            {leads.total === 0 ? (
              <p className="text-sm">{t("dashboard.noLeads")}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Counts
                  title={t("dashboard.byType")}
                  rows={leadTypes.map((type) => ({
                    label: t(`leadType.${type}`),
                    value: leads.byType[type],
                  }))}
                />
                <Counts
                  title={t("dashboard.byStatus")}
                  rows={leadStatuses.map((status) => ({
                    label: t(`leadStatus.${status}`),
                    value: leads.byStatus[status],
                  }))}
                />
                <Counts
                  title={t("dashboard.bySource")}
                  rows={leads.bySource.map(({ source, total }) => ({
                    label: <span className="break-all">{source}</span>,
                    value: total,
                  }))}
                />
              </div>
            )}
          </DashboardCard>
        ) : null}

        {inventory ? (
          <DashboardCard title={t("dashboard.apartments")} module="apartments">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.apartmentsTotal", { total: inventory.total })}
            </p>
            <Counts
              rows={apartmentStatuses.map((status) => ({
                label: <StatusBadge status={status} />,
                value: inventory.byStatus[status],
              }))}
            />
          </DashboardCard>
        ) : null}

        {translations ? (
          <DashboardCard title={t("dashboard.translations")} module="news">
            {translations.total === 0 ? (
              <p className="text-sm">{t("dashboard.translationsNone")}</p>
            ) : (
              <>
                <p className="text-sm">
                  {t("dashboard.translationsCount", { count: translations.total })}
                </p>
                <Counts
                  rows={(["en", "ru"] as const).map((locale) => ({
                    label: t(`locale.${locale}`),
                    value: translations.byLocale[locale],
                  }))}
                />
              </>
            )}
            <p className="text-sm text-muted-foreground">{t("dashboard.translationsHint")}</p>
          </DashboardCard>
        ) : null}

        {activity ? (
          <DashboardCard title={t("dashboard.activity")} module="audit">
            {activity.length === 0 ? (
              <p className="text-sm">{t("dashboard.noActivity")}</p>
            ) : (
              <ol className="text-sm flex flex-col divide-y">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 py-2">
                    <span>
                      <span className="font-medium">{entry.actor ?? t("dashboard.system")}</span>{" "}
                      {auditLabel(entry.action)}
                    </span>
                    <time
                      dateTime={entry.createdAt.toISOString()}
                      className="text-muted-foreground"
                    >
                      {adminDateTime(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </DashboardCard>
        ) : null}
      </div>
    </>
  );
}

function auditLabel(action: string): string {
  const key = `audit.${action}`;
  return isMessageKey(key) ? t(key) : t("audit.other", { action });
}

function DashboardCard({
  title,
  module,
  children,
}: {
  title: string;
  module: AdminModule;
  children: ReactNode;
}) {
  const { href, label } = adminModules[module];
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      <CardFooter className="mt-auto">
        <Link
          href={href}
          className="text-sm inline-flex min-h-(--spacing-target) items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          {t("dashboard.open", { module: t(label) })}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}

function Counts({
  title,
  rows,
}: {
  title?: string;
  rows: Array<{ label: ReactNode; value: number }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      {title ? <h3 className="text-sm text-muted-foreground font-medium">{title}</h3> : null}
      <dl className="text-sm grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {rows.map((row, index) => (
          <div key={index} className="contents">
            <dt>{row.label}</dt>
            <dd className="text-right tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
