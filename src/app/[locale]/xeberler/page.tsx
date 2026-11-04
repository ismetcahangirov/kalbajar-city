import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { EmptyState } from "@/components/content/empty-state";
import { PageHead } from "@/components/content/page-head";
import { Pagination } from "@/components/content/pagination";
import { FadeUp } from "@/components/motion";
import { NewsCard } from "@/components/news/news-card";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { Container, Section } from "@/components/ui";
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

/** `/xeberler` (#21): published articles, newest first, twelve to a page (`?sehife=`). */
export default async function NewsPage({ searchParams }: PageProps<"/[locale]/xeberler">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("News");
  const page = pageParam((await searchParams).sehife);
  const list = await getNewsPage(locale, page);
  // Past the last page there is nothing to show, and nothing to index.
  if (page > 1 && page > list.pageCount) notFound();

  return (
    <>
      <Section>
        <Container className="flex flex-col gap-block">
          <PageHead title={t("title")} lead={t("lead")} />
          {list.items.length === 0 ? (
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          ) : (
            <>
              <FadeUp
                as="ul"
                group
                className="grid gap-x-gutter gap-y-block sm:grid-cols-2 lg:grid-cols-3"
              >
                {list.items.map((article) => (
                  <li key={article.slug}>
                    <NewsCard article={article} />
                  </li>
                ))}
              </FadeUp>
              <Pagination
                page={page}
                pageCount={list.pageCount}
                href={(n) =>
                  n === 1 ? "/xeberler" : { pathname: "/xeberler", query: { sehife: String(n) } }
                }
              />
            </>
          )}
        </Container>
        <StructuredData
          locale={locale}
          nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/xeberler" }])]}
        />
      </Section>
      <NextChapter current="/xeberler" />
    </>
  );
}
