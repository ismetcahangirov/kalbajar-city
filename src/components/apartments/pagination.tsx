import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";
import { formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { pageWindow, toCatalogueQuery, type CatalogueState } from "@/shared/catalogue";

const item = cx(
  "grid min-h-target min-w-target place-items-center border-b border-transparent px-3",
  "text-label text-(--t-small) hover:text-(--t-text)",
);

/**
 * Links to the catalogue's pages, keeping the filters, sort and view: caps
 * numbers on the theme, the current page underlined in the text colour.
 */
export function Pagination({
  state,
  pageCount,
  locale,
}: {
  state: CatalogueState;
  pageCount: number;
  locale: Locale;
}) {
  const t = useTranslations("Catalogue.pagination");
  if (pageCount <= 1) return null;
  const href = (page: number) => ({
    pathname: "/menziller" as const,
    query: toCatalogueQuery({ ...state, page }),
  });
  const current = state.page;

  return (
    <nav aria-label={t("label")} data-print-hidden="">
      <ul className="flex flex-wrap items-center justify-center gap-1">
        <li>
          {current > 1 ? (
            <Link href={href(current - 1)} className={item} aria-label={t("previous")} rel="prev">
              <Icon icon={ChevronLeft} />
            </Link>
          ) : (
            <span className={cx(item, "opacity-(--opacity-disabled)")} aria-hidden>
              <Icon icon={ChevronLeft} />
            </span>
          )}
        </li>
        {pageWindow(current, pageCount).map((page, i) =>
          page === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-label text-(--t-small)">
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={href(page)}
                aria-label={t("page", { page: formatNumber(page, locale) })}
                aria-current={page === current ? "page" : undefined}
                className={cx(item, page === current && "border-(--t-text) text-(--t-text)")}
              >
                {formatNumber(page, locale)}
              </Link>
            </li>
          ),
        )}
        <li>
          {current < pageCount ? (
            <Link href={href(current + 1)} className={item} aria-label={t("next")} rel="next">
              <Icon icon={ChevronRight} />
            </Link>
          ) : (
            <span className={cx(item, "opacity-(--opacity-disabled)")} aria-hidden>
              <Icon icon={ChevronRight} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
