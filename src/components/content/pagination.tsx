import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { getTranslations } from "next-intl/server";

import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { pageWindow } from "@/shared/catalogue";

type Href = ComponentProps<typeof Link>["href"];

/** Caps labels in the theme's colours; the current page is filled, instantly. */
const item =
  "inline-flex min-h-target min-w-target items-center justify-center gap-1 border border-transparent px-u text-label uppercase";

/**
 * Links to the other pages of a content list (#21). `href` gives each page's
 * route and query; the current page is marked with `aria-current`. The
 * catalogue has its own, which keeps its filters (#18).
 */
export async function Pagination({
  page,
  pageCount,
  href,
}: {
  page: number;
  pageCount: number;
  href: (page: number) => Href;
}) {
  if (pageCount <= 1) return null;
  const t = await getTranslations("Pagination");
  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-wrap items-center gap-2">
        {page > 1 && (
          <li>
            <Link
              href={href(page - 1)}
              rel="prev"
              className={cx(item, "hover:border-(--t-control)")}
            >
              <Icon icon={ChevronLeft} />
              <span className="sr-only sm:not-sr-only">{t("previous")}</span>
            </Link>
          </li>
        )}
        {pageWindow(page, pageCount).map((n, i) =>
          n === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={t("page", { page: String(n) })}
                aria-current={n === page ? "page" : undefined}
                className={cx(
                  item,
                  n === page ? "bg-(--t-text) text-(--t-bg)" : "hover:border-(--t-control)",
                )}
              >
                {n}
              </Link>
            </li>
          ),
        )}
        {page < pageCount && (
          <li>
            <Link
              href={href(page + 1)}
              rel="next"
              className={cx(item, "hover:border-(--t-control)")}
            >
              <span className="sr-only sm:not-sr-only">{t("next")}</span>
              <Icon icon={ChevronRight} />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
