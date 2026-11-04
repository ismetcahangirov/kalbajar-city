"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { getPathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  catalogueKeys as keys,
  catalogueSorts,
  priceSorts,
  toCatalogueQuery,
  type CatalogueSort as Sort,
  type CatalogueState,
} from "@/shared/catalogue";

const sortLabels: Record<Sort, string> = {
  sahe: "areaAsc",
  "-sahe": "areaDesc",
  mertebe: "floorAsc",
  "-mertebe": "floorDesc",
  qiymet: "priceAsc",
  "-qiymet": "priceDesc",
};

/**
 * The results' sort, as the reference sets it: the current order in caps
 * with a chevron, over a native select. Choosing applies it at once (the
 * results change instantly, page 1). Without JavaScript it is a GET form
 * that carries the applied filters and sends on its button.
 */
export function CatalogueSort({
  applied,
  pricesVisible,
  locale,
}: {
  applied: CatalogueState;
  pricesVisible: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Catalogue");
  const router = useRouter();
  const sorts = catalogueSorts.filter((sort) => pricesVisible || !priceSorts.includes(sort));
  // Everything the URL says except the sort and the page.
  const carried = Object.entries(toCatalogueQuery({ ...applied, sort: undefined, page: 1 }));

  return (
    <form
      method="get"
      action={getPathname({ href: "/menziller", locale })}
      className="flex items-center gap-u"
      data-print-hidden=""
    >
      {carried.flatMap(([key, value]) =>
        (Array.isArray(value) ? value : [value]).map((item) => (
          <input key={`${key}-${item}`} type="hidden" name={key} value={item} />
        )),
      )}
      <label htmlFor="catalogue-sort" className="sr-only">
        {t("filters.sort")}
      </label>
      <span className="relative flex">
        <select
          id="catalogue-sort"
          name={keys.sort}
          value={applied.sort ?? ""}
          onChange={(event) => {
            const sort = (event.currentTarget.value || undefined) as Sort | undefined;
            router.push({
              pathname: "/menziller",
              query: toCatalogueQuery({ ...applied, sort, page: 1 }),
            });
          }}
          className="min-h-target cursor-pointer appearance-none bg-transparent pe-6 text-end text-label text-(--t-small) uppercase hover:text-(--t-text)"
        >
          <option value="" className="bg-ink text-cream">
            {t("filters.sortDefault")}
          </option>
          {sorts.map((sort) => (
            <option key={sort} value={sort} className="bg-ink text-cream">
              {t(`filters.sortOptions.${sortLabels[sort]}` as "filters.sortOptions.areaAsc")}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          focusable={false}
          width={14}
          height={14}
          strokeWidth={1.5}
          className="pointer-events-none absolute end-0 top-1/2 -translate-y-1/2 text-(--t-small)"
        />
      </span>
      <noscript>
        <button
          type="submit"
          className="min-h-target border border-(--t-control) px-u text-label uppercase"
        >
          {t("sortApply")}
        </button>
      </noscript>
    </form>
  );
}
