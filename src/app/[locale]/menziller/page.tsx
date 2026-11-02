import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ApartmentCard, ApartmentRow } from "@/components/apartments/apartment-card";
import { CatalogueFilters } from "@/components/apartments/catalogue-filters";
import { Pagination } from "@/components/apartments/pagination";
import { ViewSwitch } from "@/components/apartments/view-switch";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { buttonClass, Container, Heading, Text } from "@/components/ui";
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
    <Container className="flex flex-col gap-block pt-block pb-section">
      <header className="flex flex-col gap-4">
        <Heading as="h1" size="display">
          {title}
        </Heading>
        <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
          {t("lead")}
        </Text>
      </header>

      <div className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
        <div className="lg:col-span-4 xl:col-span-3">
          <CatalogueFilters facets={facets} applied={state} total={page.total} locale={locale} />
        </div>

        <section
          aria-labelledby="catalogue-results"
          className="flex min-w-0 flex-col gap-8 lg:col-span-8 xl:col-span-9"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="catalogue-results" className="sr-only">
              {t("resultsLabel")}
            </h2>
            {/* Announced when applying filters re-renders the page in place. */}
            <p role="status" className="text-body">
              {t("results", { count: page.total })}
              {page.pageCount > 1 && (
                <span className="text-text-muted">
                  {" · "}
                  {t("pageOf", {
                    page: formatNumber(state.page, locale),
                    pages: formatNumber(page.pageCount, locale),
                  })}
                </span>
              )}
            </p>
            <ViewSwitch state={state} />
          </div>

          {page.items.length === 0 ? (
            <EmptyState state={state} locale={locale} pricesVisible={pricesVisible} />
          ) : state.view === "list" ? (
            <ul className="border-t border-border">
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
            <ul className="grid gap-x-gutter gap-y-block sm:grid-cols-2 xl:grid-cols-3">
              {page.items.map((apartment) => (
                <li key={apartment.slug}>
                  <ApartmentCard
                    apartment={apartment}
                    locale={locale}
                    pricesVisible={pricesVisible}
                  />
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
    </Container>
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
    <div className="flex flex-col items-start gap-4 rounded-md bg-surface-alt p-6 sm:p-8">
      <Heading as="h3" size="heading">
        {t("empty.title")}
      </Heading>
      {nearest && (
        <>
          <Text>
            {t("empty.suggestion", { filter: groupLabel[nearest.group], count: nearest.total })}
          </Text>
          <Link
            href={{ pathname: "/menziller", query: toCatalogueQuery(nearest.relaxed) }}
            className={buttonClass({ variant: "primary" })}
          >
            {t("empty.show")}
          </Link>
        </>
      )}
      <Link
        href={{
          pathname: "/menziller",
          query: toCatalogueQuery({ ...emptyFilters, page: 1, view: state.view }),
        }}
        className={buttonClass({ variant: nearest ? "link" : "primary" })}
      >
        {t("empty.reset")}
      </Link>
    </div>
  );
}
