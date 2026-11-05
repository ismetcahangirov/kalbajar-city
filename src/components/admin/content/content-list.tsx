"use client";

import { CircleDashed, Plus } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { adminDateTime } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import type { Page } from "@/shared/api";
import {
  contentStates,
  scheduleOverdue,
  type ContentListParams,
  type ContentState,
} from "@/shared/content";

import { ContentStateBadge } from "./content-state-badge";

const pageSize = 20;

/** What every publishable entry has, whatever else it carries. */
type Entry = {
  id: string;
  state: ContentState;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

function dateLine(item: Entry, overdue: boolean): string {
  if (item.state === "scheduled" && item.scheduledAt) {
    const date = adminDateTime(item.scheduledAt);
    return overdue ? t("content.overdueSince", { date }) : t("content.scheduledFor", { date });
  }
  if (item.state === "published" && item.publishedAt) {
    return t("content.publishedOn", { date: adminDateTime(item.publishedAt) });
  }
  return t("content.updatedOn", { date: adminDateTime(item.updatedAt) });
}

/**
 * A list of publishable entries (#25: articles, construction updates): each
 * with its state, its date and what is untranslated, filterable by state,
 * paginated.
 */
export function ContentList<T extends Entry>({
  heading,
  empty,
  baseHref,
  newLabel,
  canCreate,
  useList,
  titleOf,
  metaOf,
  missingOf,
}: {
  heading: string;
  empty: string;
  /** The module's URL: entries open at `/<id>`, the form for a new one at `/yeni`. */
  baseHref: string;
  newLabel: string;
  canCreate: boolean;
  useList: (params: ContentListParams) => {
    data?: Page<T>;
    isLoading: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => unknown;
  };
  titleOf: (item: T) => string;
  /** A line above the date, for what tells entries apart besides their title. */
  metaOf?: (item: T) => string;
  missingOf: (item: T) => Locale[];
}) {
  const headingId = useId();
  const [state, setState] = useState<ContentState | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useList({
    page,
    pageSize,
    status: state ? [state] : undefined,
  });
  const items = data?.items ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-medium">
          {heading}
        </h2>
        {canCreate ? (
          <Button asChild>
            <Link href={`${baseHref}/yeni`}>
              <Plus aria-hidden />
              {newLabel}
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
            // The list is fetched in the browser, so the clock here is the reader's.
            const overdue = scheduleOverdue(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`${baseHref}/${item.id}`}
                    className="inline-flex min-h-target items-center font-medium break-words hover:underline"
                  >
                    {titleOf(item)}
                  </Link>
                  {metaOf ? <span className="text-sm">{metaOf(item)}</span> : null}
                  <span className="text-sm text-muted-foreground">{dateLine(item, overdue)}</span>
                </div>
                <span className="flex flex-wrap gap-1 sm:justify-end">
                  <ContentStateBadge state={item.state} overdue={overdue} />
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
          {state ? t("table.emptyFiltered") : empty}
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

/** The locales any of these missing lists names, in the site's order. */
export function missingAcross(locales: readonly Locale[], ...missing: Locale[][]): Locale[] {
  const all = new Set(missing.flat());
  return locales.filter((locale) => all.has(locale));
}
