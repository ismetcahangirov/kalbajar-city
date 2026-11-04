"use client";

import { CircleDashed, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { locales } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { adminDateTime } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import { missingLocales, missingRichLocales } from "@/lib/admin/translatables";
import { contentStates, type AdminNews, type ContentState } from "@/shared/content";
import { useAdminNewsListQuery } from "@/store/endpoints/admin-content";

import { contentPages } from "./content-nav";
import { ContentStateBadge } from "./content-state-badge";

const pageSize = 20;

function dateLine(item: AdminNews): string {
  if (item.state === "scheduled" && item.scheduledAt) {
    return t("news.scheduledFor", { date: adminDateTime(item.scheduledAt) });
  }
  if (item.state === "published" && item.publishedAt) {
    return t("news.publishedOn", { date: adminDateTime(item.publishedAt) });
  }
  return t("news.updatedOn", { date: adminDateTime(item.updatedAt) });
}

function missingOf(item: AdminNews) {
  const missing = new Set([
    ...missingLocales(item.title),
    ...(item.excerpt ? missingLocales(item.excerpt) : []),
    ...missingRichLocales(item.body),
  ]);
  return locales.filter((locale) => missing.has(locale));
}

/** The articles, newest first, filterable by state (#25). */
export function NewsList({ canCreate }: { canCreate: boolean }) {
  const [state, setState] = useState<ContentState | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAdminNewsListQuery({
    page,
    pageSize,
    status: state ? [state] : undefined,
  });
  const items = data?.items ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <section aria-labelledby="news-heading" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="news-heading" className="text-lg font-medium">
          {t("news.list")}
        </h2>
        {canCreate ? (
          <Button asChild>
            <Link href={`${contentPages.news.href}/yeni`}>
              <Plus aria-hidden />
              {t("news.new")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div role="group" aria-label={t("contentState.filter")} className="flex flex-wrap gap-1">
        {[null, ...contentStates].map((value) => (
          <Button
            key={value ?? "all"}
            type="button"
            variant={state === value ? "secondary" : "ghost"}
            aria-pressed={state === value}
            onClick={() => {
              setState(value);
              setPage(1);
            }}
          >
            {value ? t(`contentState.${value}`) : t("contentState.all")}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy>
          <span className="sr-only">{t("table.loading")}</span>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-16 rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-md border p-4">
          <p>{t("table.error")}</p>
          <p className="text-sm text-muted-foreground">{apiErrorMessage(error)}</p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            {t("ui.retry")}
          </Button>
        </div>
      ) : items.length ? (
        <ul className="flex flex-col divide-y rounded-md border">
          {items.map((item) => {
            const missing = missingOf(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`${contentPages.news.href}/${item.id}`}
                    className="inline-flex min-h-target items-center font-medium break-words hover:underline"
                  >
                    {item.title.az}
                  </Link>
                  <span className="text-sm text-muted-foreground">{dateLine(item)}</span>
                </div>
                <span className="flex flex-wrap gap-1 sm:justify-end">
                  <ContentStateBadge state={item.state} />
                  {missing.length ? (
                    <Badge variant="outline">
                      <CircleDashed aria-hidden />
                      {t("content.missing", {
                        locales: missing.map((locale) => locale.toUpperCase()).join(", "),
                      })}
                    </Badge>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed p-6">
          {state ? t("table.emptyFiltered") : t("news.empty")}
        </p>
      )}

      {pageCount > 1 ? (
        <nav aria-label={t("table.pagination")} className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t("table.previous")}
          </Button>
          <span className="text-sm" aria-live="polite">
            {t("table.page", { page, pageCount })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            {t("table.next")}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
