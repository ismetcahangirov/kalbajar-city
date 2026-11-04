import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ApartmentRow } from "@/components/apartments/apartment-card";
import { CatalogueFilters } from "@/components/apartments/catalogue-filters";
import { CatalogueSort } from "@/components/apartments/catalogue-sort";
import { CurtainLines } from "@/components/apartments/curtain-lines";
import { Pagination } from "@/components/apartments/pagination";
import { ViewSwitch } from "@/components/apartments/view-switch";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { FlatCard } from "@/components/ui/flat-card";
import { formatNumber } from "@/i18n/format";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCatalogueFacets, listPublicApartments } from "@/lib/public/apartments";
import { pageMetadata } from "@/lib/seo/page-metadata";
import {
  activeGroups,
  emptyFilters,
  isIndexableCatalogue,
  parseCatalogueParams,
  toApartmentListQuery,
  toCatalogueQuery,
  withoutGroup,
  withoutHiddenPrices,
  type CatalogueState,
  type FilterGroup,
} from "@/shared/catalogue";
import { NextChapter } from "@/components/shell/next-chapter";

// Filtered views are real URLs read from searchParams, so the page renders
// per request and is sent complete, not streamed behind Suspense (CLAUDE.md
// → Data and state). The loaders are cached and tagged, so a request costs a
// cache read until the console changes the inventory.
export const instant = false;

const pageSize = 12;

/** The room count a page is about, when exactly one is chosen. */
function singleRooms(state: CatalogueState): number | undefined {
  return state.rooms.length === 1 ? state.rooms[0] : undefined;
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/menziller">): Promise<Metadata> {
  const params = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Catalogue");
  const apartments = await getTranslations("Apartments");
  const indexable = isIndexableCatalogue(params);
  const rooms = indexable ? singleRooms(parseCatalogueParams(params)) : undefined;
  // Filter combinations are views of the landing pages, not pages of their own.
  return pageMetadata({
    locale,
    href: rooms ? { pathname: "/menziller", query: { otaq: String(rooms) } } : "/menziller",
    title: rooms ? t("titleRooms", { rooms: formatNumber(rooms, locale) }) : apartments("title"),
    description: rooms
      ? t("descriptionRooms", { rooms: formatNumber(rooms, locale) })
      : t("description"),
    indexable,
  });
}

export default async function CataloguePage({ searchParams }: PageProps<"/[locale]/menziller">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Catalogue");
  const apartments = await getTranslations("Apartments");
  const facets = await getCatalogueFacets(locale);
  const pricesVisible = facets.pricesVisible;
  const state = withoutHiddenPrices(parseCatalogueParams(await searchParams), pricesVisible);
  const page = await listPublicApartments(
    toApartmentListQuery(state, { locale, pageSize, pricesVisible }),
  );

  // A page past the end (the inventory shrank under a shared link).
  if (!page.items.length && page.total > 0) {
    redirect({
      href: { pathname: "/menziller", query: toCatalogueQuery({ ...state, page: 1 }) },
      locale,
    });
  }

  const rooms = singleRooms(state);
  const title = rooms
    ? t("titleRooms", { rooms: formatNumber(rooms, locale) })
    : apartments("title");

  return (
    <>
      <div
        data-theme="dark"
        className="relative isolate flex flex-1 flex-col bg-umber bg-(image:--gradient-curtain) bg-no-repeat text-(--t-text)"
      >
        <CurtainLines />
        {/* The header runs transparent over the title, as over a hero. */}
        <header
          data-header-overlay=""
          className="flex flex-col items-center gap-u2 px-layout pt-[calc(var(--header-height)+var(--u)*6)] pb-u6 text-center desk:pt-[calc(var(--header-height)+var(--u)*6)] desk:pb-u4"
        >
          <h1 className="text-title text-(--t-primary) uppercase">{title}</h1>
          <p className="max-w-(--container-prose) text-body text-(--t-small)">{t("lead")}</p>
        </header>

        {/* Below the curtain's top 70svh sand fails 4.5 : 1 for small text,
            so the filters and results set it in the text colour. */}
        <div className="grid gap-y-u2 pb-[calc(var(--floating-bottom)+var(--u)*8)] [--t-small:var(--t-text)] lg:grid-cols-3 lg:pb-u12">
          <div className="px-layout">
            <CatalogueFilters facets={facets} applied={state} total={page.total} locale={locale} />
          </div>

          <section
            aria-labelledby="catalogue-results"
            className="flex min-w-0 flex-col gap-u2 px-layout lg:col-span-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-u2 border-b border-(--t-line) pb-u">
              <h2 id="catalogue-results" className="sr-only">
                {t("resultsLabel")}
              </h2>
              {/* Announced when applying filters re-renders the page in place. */}
              <p role="status" className="text-label text-(--t-small) uppercase">
                {t("results", { count: page.total })}
                {page.pageCount > 1 && (
                  <span>
                    {" · "}
                    {t("pageOf", {
                      page: formatNumber(state.page, locale),
                      pages: formatNumber(page.pageCount, locale),
                    })}
                  </span>
                )}
              </p>
              <div className="ms-auto flex flex-wrap items-center justify-end gap-x-u2">
                <ViewSwitch state={state} />
                <CatalogueSort applied={state} pricesVisible={pricesVisible} locale={locale} />
              </div>
            </div>

            {page.items.length === 0 ? (
              <EmptyState state={state} locale={locale} pricesVisible={pricesVisible} />
            ) : state.view === "list" ? (
              <ul>
                {page.items.map((apartment) => (
                  <ApartmentRow
                    key={apartment.slug}
                    apartment={apartment}
                    locale={locale}
                    pricesVisible={pricesVisible}
                  />
                ))}
              </ul>
            ) : (
              <ul className="grid gap-u2 desk:grid-cols-2">
                {page.items.map((apartment) => (
                  <li key={apartment.slug}>
                    <FlatCard apartment={apartment} locale={locale} pricesVisible={pricesVisible} />
                  </li>
                ))}
              </ul>
            )}

            <Pagination state={state} pageCount={page.pageCount} locale={locale} />
          </section>
        </div>
        <StructuredData
          locale={locale}
          nodes={[await breadcrumbs(locale, [{ name: apartments("title"), href: "/menziller" }])]}
        />
      </div>
      <NextChapter current="/menziller" />
    </>
  );
}

/**
 * Nothing matches. Suggests the nearest match: the one filter whose removal
 * brings back the most apartments, with how many, as a link.
 */
async function EmptyState({
  state,
  locale,
  pricesVisible,
}: {
  state: CatalogueState;
  locale: Locale;
  pricesVisible: boolean;
}) {
  const t = await getTranslations("Catalogue");
  const labels = await getTranslations("Catalogue.filters");
  const options = { locale, pageSize: 1, pricesVisible };
  const candidates = await Promise.all(
    activeGroups(state).map(async (group) => {
      const relaxed = { ...withoutGroup(state, group), page: 1 };
      const { total } = await listPublicApartments(toApartmentListQuery(relaxed, options));
      return { group, relaxed, total };
    }),
  );
  const nearest = candidates
    .filter((candidate) => candidate.total > 0)
    .sort((a, b) => b.total - a.total)[0];
  const groupLabel: Record<FilterGroup, string> = {
    rooms: labels("rooms"),
    area: labels("area"),
    blocks: labels("blocks"),
    floor: labels("floor"),
    statuses: labels("statuses"),
    price: labels("price"),
  };

  return (
    <div className="flex flex-col items-start gap-u2 border border-(--t-line-alt) p-u2 desk:p-u3">
      <h3 className="text-lead text-(--t-text)">{t("empty.title")}</h3>
      {nearest && (
        <>
          <p className="text-body">
            {t("empty.suggestion", { filter: groupLabel[nearest.group], count: nearest.total })}
          </p>
          <ArrowBlock
            as="link"
            href={{ pathname: "/menziller", query: toCatalogueQuery(nearest.relaxed) }}
          >
            {t("empty.show")}
          </ArrowBlock>
        </>
      )}
      <Link
        href={{
          pathname: "/menziller",
          query: toCatalogueQuery({ ...emptyFilters, page: 1, view: state.view }),
        }}
        className="flex min-h-target items-center text-label text-(--t-text) uppercase underline underline-offset-4"
      >
        {t("empty.reset")}
      </Link>
    </div>
  );
}
