import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { toCatalogueQuery, type CatalogueState, type CatalogueView } from "@/shared/catalogue";

const views = ["grid", "list"] as const satisfies ReadonlyArray<CatalogueView>;

/**
 * Cards or list, kept in the URL (`gorunus=siyahi`) like every other choice.
 * The reference has no such switch; ours stays because shared links and the
 * keyboard tests use the list, restyled as caps tabs on the theme.
 */
export function ViewSwitch({ state }: { state: CatalogueState }) {
  const t = useTranslations("Catalogue.view");
  return (
    <nav aria-label={t("label")} data-print-hidden="">
      <ul className="flex">
        {views.map((view) => {
          const current = state.view === view;
          return (
            <li key={view}>
              <Link
                href={{ pathname: "/menziller", query: toCatalogueQuery({ ...state, view }) }}
                aria-current={current ? "true" : undefined}
                className={cx(
                  "inline-flex min-h-target items-center gap-2 border-b px-u text-label uppercase",
                  current
                    ? "border-(--t-text) text-(--t-text)"
                    : "border-transparent text-(--t-small) hover:text-(--t-text)",
                )}
              >
                {t(view)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
