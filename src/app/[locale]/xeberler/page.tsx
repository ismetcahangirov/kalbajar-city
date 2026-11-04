import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { EmptyState } from "@/components/content/empty-state";
import { Pagination } from "@/components/content/pagination";
import { Reveal } from "@/components/motion/reveal";
import { NewsCard } from "@/components/news/news-card";
import { PageHero } from "@/components/pages/page-hero";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import type { Locale } from "@/i18n/routing";
import { getNewsPage } from "@/lib/public/news";
import { pageParam } from "@/lib/public/query";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { NextChapter } from "@/components/shell/next-chapter";

// The page number is in the query string and the data in the database:
// rendered per request and sent complete (CLAUDE.md → Data and state).
export const instant = false;

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/xeberler">): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("News");
  const pages = await getTranslations("Pagination");
  const page = pageParam((await searchParams).sehife);
  // Later pages are views of the list: noindex, follow, canonical to page one.
  return pageMetadata({
    locale,
    href: "/xeberler",
    title: page > 1 ? `${t("title")} · ${pages("page", { page: String(page) })}` : t("title"),
    description: t("description"),
    indexable: page === 1,
  });
}

/**
 * `/xeberler` (#21) after the reference's `/news`: a taupe page, the split
 * title over a hairline, and the published articles, newest first, in three
 * columns divided by 1 px rules, twelve to a page (`?sehife=`).
 */
export default async function NewsPage({ searchParams }: PageProps<"/[locale]/xeberler">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("News");
  const words = await getTranslations("Pages.words");
  const page = pageParam((await searchParams).sehife);
  const list = await getNewsPage(locale, page);
  // Past the last page there is nothing to show, and nothing to index.
  if (page > 1 && page > list.pageCount) notFound();

  return (
    <>
      <PageHero
        title={t("title")}
        word={words("news")}
        subtitle={t("lead")}
        next="xeber-siyahisi"
        theme="dark-alt"
        layout="plain"
      />
      <section
        id="xeber-siyahisi"
        data-theme="dark-alt"
        aria-label={t("title")}
        className="flex flex-col gap-u4 bg-(--t-bg) px-layout py-u3 pb-u6 text-(--t-text) desk:pb-u9"
      >
        {list.items.length === 0 ? (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <>
            <Reveal
              kind="image-in"
              group
              as="ul"
              className="grid gap-y-u4 desk:grid-cols-2 lg:grid-cols-3"
            >
              {list.items.map((article) => (
                <li
                  key={article.slug}
                  className="border-(--t-line) desk:border-s desk:px-u desk:[&:nth-child(2n+1)]:border-s-0 desk:[&:nth-child(2n+1)]:ps-0 lg:[&:nth-child(2n+1)]:border-s lg:[&:nth-child(2n+1)]:ps-u lg:[&:nth-child(3n+1)]:border-s-0 lg:[&:nth-child(3n+1)]:ps-0"
                >
                  <NewsCard article={article} />
                </li>
              ))}
            </Reveal>
            <Pagination
              page={page}
              pageCount={list.pageCount}
              href={(n) =>
                n === 1 ? "/xeberler" : { pathname: "/xeberler", query: { sehife: String(n) } }
              }
            />
          </>
        )}
      </section>
      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/xeberler" }])]}
      />
      <NextChapter current="/xeberler" />
    </>
  );
}
