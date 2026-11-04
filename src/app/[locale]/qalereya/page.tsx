import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { EmptyState } from "@/components/content/empty-state";
import { Lightbox } from "@/components/content/lightbox";
import { PageHero } from "@/components/pages/page-hero";
import { ScreenSlider } from "@/components/pages/screen-slider";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { ChapterTabs } from "@/components/shell/chapter-tabs";
import { NextChapter } from "@/components/shell/next-chapter";
import { defaultImage } from "@/content/defaults";
import { formatNumber } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { getGallery } from "@/lib/public/gallery";
import { categoryParam } from "@/lib/public/query";
import { pageMetadata } from "@/lib/seo/page-metadata";

// The filter is in the query string and the data in the database: rendered
// per request and sent complete (CLAUDE.md → Data and state).
export const instant = false;

/** How many images the screen slider shows before the full collection. */
const screenCount = 5;

/**
 * Only the unfiltered gallery is indexed; a filtered view points search
 * engines to it (#21).
 */
export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/qalereya">): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Gallery");
  // A category is a view of the gallery: indexable only without one.
  return pageMetadata({
    locale,
    href: "/qalereya",
    title: t("title"),
    description: t("description"),
    indexable: (await searchParams).kateqoriya === undefined,
  });
}

/**
 * `/qalereya` after the reference's `/spaces`: the split title, the sticky
 * screen slider of the first images with its thumbnail strip (unfiltered
 * view only), then every image with the category links
 * (`?kateqoriya=<slug>`) and the lightbox. Gallery items are real data:
 * none has a default image.
 */
export default async function GalleryPage({ searchParams }: PageProps<"/[locale]/qalereya">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Gallery");
  const words = await getTranslations("Pages.words");
  const shell = await getTranslations("Shell");
  const gallery = await getGallery(locale);
  const active = categoryParam(
    (await searchParams).kateqoriya,
    gallery.categories.map((category) => category.slug),
  );
  const items = active ? gallery.items.filter((item) => item.category === active) : gallery.items;
  const screens = active ? [] : gallery.items.slice(0, screenCount);

  const filters = [
    {
      key: "all",
      label: t("all"),
      count: gallery.items.length,
      href: { pathname: "/qalereya" as const },
      current: active === null,
      lang: undefined,
    },
    ...gallery.categories.map((category) => ({
      key: category.slug,
      label: category.name.value,
      count: category.count,
      href: { pathname: "/qalereya" as const, query: { kateqoriya: category.slug } },
      current: active === category.slug,
      lang: category.name.fallback ? category.name.locale : undefined,
    })),
  ];

  return (
    <>
      <PageHero
        title={t("title")}
        word={words("gallery")}
        subtitle={t("lead")}
        next={screens.length ? "secilmis" : "hamisi"}
        theme="dark"
        layout="framed"
        image={defaultImage("page.qalereya", locale)}
      />

      {screens.length > 0 && (
        <ScreenSlider id="secilmis" title={t("screensTitle")} screens={screens} />
      )}

      <section
        id="hamisi"
        data-theme="light"
        aria-labelledby="hamisi-basliq"
        className="flex flex-col gap-u4 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
      >
        <h2
          id="hamisi-basliq"
          className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
        >
          {t("allTitle")}
        </h2>
        {items.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <>
            {gallery.categories.length > 1 && (
              // Filters never animate (motion-system.md): cells joined by their borders.
              <nav aria-label={t("filter")}>
                <ul className="flex flex-wrap ps-px">
                  {filters.map((filter) => (
                    <li key={filter.key} className="-ms-px -mt-px">
                      <Link
                        href={filter.href}
                        aria-current={filter.current ? "page" : undefined}
                        className={cx(
                          "relative inline-flex min-h-target items-center gap-u border px-u text-body",
                          filter.current
                            ? "z-1 border-(--t-text) bg-(--t-text) text-(--t-bg)"
                            : "border-(--t-control) hover:z-1 hover:border-(--t-text)",
                        )}
                      >
                        <span lang={filter.lang}>{filter.label}</span>
                        <span className="text-small-t">{formatNumber(filter.count, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {/* Keyed by the filter, so the lightbox's state starts over with the new set. */}
            <Lightbox
              key={active ?? "all"}
              layout="masonry"
              items={items}
              sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 50vw, 100vw"
            />
          </>
        )}
      </section>

      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/qalereya" }])]}
      />
      {screens.length > 0 && (
        <ChapterTabs
          label={shell("sections")}
          tabs={[
            { id: "secilmis", label: t("tabs.screens") },
            { id: "hamisi", label: t("tabs.all") },
          ]}
        />
      )}
      <NextChapter current="/qalereya" />
    </>
  );
}
