import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { RichText } from "@/components/content/rich-text";
import { ShareButton } from "@/components/content/share-button";
import { Localized } from "@/components/home/localized";
import { FadeUp, LineReveal } from "@/components/motion";
import { NewsCard } from "@/components/news/news-card";
import { Button, Container, Heading, Icon, Picture, Section, Text } from "@/components/ui";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getNewsArticle } from "@/lib/public/news";

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
  return {
    title: article.title.value,
    description: article.excerpt?.value,
    openGraph: { type: "article", publishedTime: article.publishedAt },
  };
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
  const titleLang = article.title.fallback ? article.title.locale : undefined;

  return (
    <>
      <Section>
        <article aria-labelledby="meqale" className="flex flex-col gap-block">
          <Container size="prose" className="flex flex-col gap-6">
            <div>
              <Button
                href={getPathname({ href: "/xeberler", locale })}
                variant="link"
                leadingIcon={<Icon icon={ArrowLeft} />}
              >
                {t("all")}
              </Button>
            </div>
            <Heading as="h1" size="display" id="meqale" lang={titleLang}>
              {article.title.value}
            </Heading>
            <Text size="small" tone="muted">
              {t("published")}:{" "}
              <time dateTime={article.publishedAt}>
                {format.dateTime(new Date(article.publishedAt), "long")}
              </time>
            </Text>
            {article.lead && (
              <Text size="body-lg" tone="muted">
                <Localized text={article.lead} />
              </Text>
            )}
          </Container>

          {article.cover && (
            <Container>
              {/* Above the fold, so it is the LCP candidate: no entry, loaded first. */}
              <div className="relative aspect-hero-mobile overflow-hidden rounded-md bg-surface-alt sm:aspect-hero">
                <Picture image={article.cover} sizes="(min-width: 90rem) 90rem, 100vw" priority />
              </div>
            </Container>
          )}

          <Container size="prose" className="flex flex-col gap-block">
            <RichText text={article.body} />
            <ShareButton title={article.title.value} />
          </Container>
        </article>
      </Section>

      {article.related.length > 0 && (
        <Section tone="limestone" aria-labelledby="diger-xeberler">
          <Container className="flex flex-col gap-block">
            <LineReveal as="h2" id="diger-xeberler" size="display">
              {t("related")}
            </LineReveal>
            <FadeUp
              as="ul"
              group
              className="grid gap-x-gutter gap-y-block sm:grid-cols-2 lg:grid-cols-3"
            >
              {article.related.map((other) => (
                <li key={other.slug}>
                  <NewsCard article={other} titleAs="h3" />
                </li>
              ))}
            </FadeUp>
          </Container>
        </Section>
      )}
    </>
  );
}
