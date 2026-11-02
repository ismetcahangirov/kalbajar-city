import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { toCatalogueQuery, type CatalogueState, type CatalogueView } from "@/shared/catalogue";

const views = [
  { view: "grid", icon: LayoutGrid },
  { view: "list", icon: List },
] as const satisfies ReadonlyArray<{ view: CatalogueView; icon: typeof List }>;

/** Cards or list, kept in the URL (`gorunus=siyahi`) like every other choice. */
export function ViewSwitch({ state }: { state: CatalogueState }) {
  const t = useTranslations("Catalogue.view");
  return (
    <nav aria-label={t("label")} data-print-hidden="">
      <ul className="flex rounded-full border border-border-strong p-0.5">
        {views.map(({ view, icon }) => {
          const current = state.view === view;
          return (
            <li key={view}>
              <Link
                href={{ pathname: "/menziller", query: toCatalogueQuery({ ...state, view }) }}
                aria-current={current ? "true" : undefined}
                className={cx(
                  "inline-flex min-h-target items-center gap-2 rounded-full px-4 text-small font-medium",
                  current ? "bg-action text-action-text" : "text-text hover:bg-surface-alt",
                )}
              >
                <Icon icon={icon} />
                {t(view)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
