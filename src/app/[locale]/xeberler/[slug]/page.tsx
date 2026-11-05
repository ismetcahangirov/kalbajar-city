import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { RichText } from "@/components/content/rich-text";
import { ShareButton } from "@/components/content/share-button";
import { PageMessages } from "@/components/i18n/page-messages";
import { Localized } from "@/components/home/localized";
import { Reveal } from "@/components/motion/reveal";
import { NewsCard } from "@/components/news/news-card";
import { ArticleHead } from "@/components/pages/article-head";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { Picture } from "@/components/ui/picture";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDeveloper } from "@/lib/public/site";
import { getNewsArticle } from "@/lib/public/news";
import { newsArticleNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

// The slug is only known at request time and the article is in the database:
// rendered per request and sent complete (CLAUDE.md → Data and state).
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/xeberler/[slug]">): Promise<Metadata> {
  await connection();
  const locale = (await getLocale()) as Locale;
  const article = await getNewsArticle(locale, (await params).slug);
  if (!article) return {};
  return pageMetadata({
    locale,
    href: { pathname: "/xeberler/[slug]", params: { slug: article.slug } },
    title: article.title.value,
    description: article.excerpt?.value,
    image: "own",
    article: { publishedTime: article.publishedAt, modifiedTime: article.updatedAt },
  });
}

/**
 * `/xeberler/[slug]` (#21): a published article. The slug is Azerbaijani in
 * every locale; a draft or an unknown slug is a 404.
 */
export default async function ArticlePage({ params }: PageProps<"/[locale]/xeberler/[slug]">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const article = await getNewsArticle(locale, (await params).slug);
  if (!article) notFound();

  const t = await getTranslations("News");
  const format = await getFormatter();
  const developer = await getDeveloper();
  const origin = siteOrigin();
  const href = { pathname: "/xeberler/[slug]", params: { slug: article.slug } } as const;
  const path = getPathname({ href, locale });
  const titleLang = article.title.fallback ? article.title.locale : undefined;

  return (
    <>
      {/* The reference's article on light: title, date and rule, the cover
          centred at 720 px, and the body in a 720 px column. */}
      <article
        aria-labelledby="meqale"
        data-theme="light"
        className="flex flex-col bg-(--t-bg) pb-u6 text-(--t-text) desk:pb-u9"
      >
        <ArticleHead
          id="meqale"
          title={article.title.value}
          lang={titleLang}
          back={{ href: "/xeberler", label: t("all") }}
          meta={
            <>
              <span className="sr-only">{t("published")}: </span>
              <time dateTime={article.publishedAt}>
                {format.dateTime(new Date(article.publishedAt), "long")}
              </time>
            </>
          }
        />

        <div className="flex flex-col gap-u4 px-layout pt-u3 desk:pt-u3">
          {article.cover && (
            // Above the fold, so it is the LCP candidate: no entry, loaded first.
            <div className="relative mx-auto aspect-[720/345] w-full max-w-[45rem] overflow-hidden bg-(--t-line)">
              <Picture image={article.cover} sizes="(min-width: 48rem) 45rem, 100vw" priority />
            </div>
          )}
          <div className="mx-auto flex w-full max-w-[45rem] flex-col gap-u4">
            {article.lead && (
              <p className="text-lead">
                <Localized text={article.lead} />
              </p>
            )}
            <RichText text={article.body} />
            <PageMessages namespaces={["Share"]}>
              <ShareButton title={article.title.value} />
            </PageMessages>
          </div>
        </div>
      </article>

      {article.related.length > 0 && (
        <section
          data-theme="dark-alt"
          aria-labelledby="diger-xeberler"
          className="flex flex-col gap-u4 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <Reveal
            kind="text"
            as="h2"
            id="diger-xeberler"
            className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
          >
            {t("related")}
          </Reveal>
          <ul className="grid gap-y-u4 desk:grid-cols-3">
            {article.related.map((other) => (
              <li
                key={other.slug}
                className="border-(--t-line) desk:border-s desk:px-u desk:first:border-s-0 desk:first:ps-0"
              >
                <NewsCard article={other} titleAs="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <StructuredData
        locale={locale}
        nodes={[
          await breadcrumbs(locale, [
            { name: t("title"), href: "/xeberler" },
            { name: article.title.value, href },
          ]),
          newsArticleNode({
            origin,
            url: absoluteUrl(path, origin),
            headline: article.title.value,
            description: article.excerpt?.value ?? null,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            images: [article.cover?.src ?? null, absoluteUrl(`${path}/opengraph-image`, origin)],
            author: { name: developer.name, url: developer.website ?? absoluteUrl("/", origin) },
          }),
        ]}
      />
    </>
  );
}
