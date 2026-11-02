import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { About, Amenities } from "@/components/home/sections";
import { SectionHead } from "@/components/home/section-head";
import { FadeUp } from "@/components/motion";
import { PageHead } from "@/components/site/page-head";
import { breadcrumbs, complexNode, StructuredData } from "@/components/seo/structured-data";
import { Button, Container, Icon, Section, Text } from "@/components/ui";
import type { Localized } from "@/i18n/content";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { factSentences } from "@/lib/facts";
import { getAboutPage } from "@/lib/public/site";
import { pageMetadata } from "@/lib/seo/page-metadata";

// The copy, facts and amenities are console data: rendered per request and
// sent complete (CLAUDE.md → Data and state).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("About");
  return pageMetadata({
    locale,
    href: "/haqqimizda",
    title: nav("about"),
    description: t("description"),
  });
}

/**
 * The complex, its facts, its amenities and its developer. The introduction is
 * the home page's about section and the rest comes from `settings`, so the
 * console edits each fact in one place.
 */
export default async function AboutPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const page = await getAboutPage(locale);
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("About");
  const facts = await getTranslations("About.facts");
  // Catalogue copy in the page's own language, for components that take console text.
  const own = (value: string): Localized => ({ value, locale, fallback: false });
  const sentences = page.facts ? factSentences(page.facts, page.developer.name, locale) : [];
  const developerLinks = [
    { key: "website", href: page.developer.website },
    { key: "instagram", href: page.developer.instagram },
  ] as const;

  return (
    <>
      <PageHead title={nav("about")} lead={t("lead")} />
      {page.intro && <About kind="about" {...page.intro} tone="limestone" align="start" />}

      {sentences.length > 0 && (
        <Section aria-labelledby="faktlar">
          <Container className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
            <div className="lg:col-span-5">
              <SectionHead id="faktlar" title={own(t("factsTitle"))} align="start" />
            </div>
            {/* Plain sentences, each true on its own, so they can be quoted as they are. */}
            <FadeUp as="ul" group className="flex flex-col lg:col-span-7">
              {sentences.map((sentence) => (
                <li key={sentence.key} className="border-t border-border py-5 text-body-lg">
                  {/* The values match each message's arguments; tests/unit/facts.test.ts renders them all. */}
                  {facts(sentence.key, sentence.values as never)}
                </li>
              ))}
            </FadeUp>
          </Container>
        </Section>
      )}

      {page.amenities.length > 0 && (
        <Amenities
          kind="amenities"
          title={own(t("amenities"))}
          items={page.amenities}
          tone="limestone"
          align="center"
        />
      )}

      <Section aria-labelledby="tikintici">
        <Container className="flex flex-col gap-block">
          <SectionHead
            id="tikintici"
            eyebrow={own(t("developer.eyebrow"))}
            title={own(page.developer.name)}
            align="start"
          />
          <FadeUp className="flex flex-col gap-6">
            <Text size="body-lg" className="max-w-(--container-prose)">
              {t("developer.body", { developer: page.developer.name })}
            </Text>
            <ul className="flex flex-wrap gap-x-6">
              {developerLinks.map(({ key, href }) =>
                href ? (
                  <li key={key}>
                    <Button
                      href={href}
                      variant="link"
                      rel="noopener noreferrer"
                      trailingIcon={<Icon icon={ArrowUpRight} />}
                    >
                      {t(`developer.${key}`)}
                    </Button>
                  </li>
                ) : null,
              )}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button
                href={getPathname({ href: "/menziller", locale })}
                trailingIcon={<Icon icon={ArrowRight} />}
              >
                {t("apartments")}
              </Button>
              <Button href={`${getPathname({ href: "/elaqe", locale })}#baxis`} variant="secondary">
                {t("viewing")}
              </Button>
            </div>
          </FadeUp>
        </Container>
      </Section>
      <StructuredData
        locale={locale}
        nodes={[
          await complexNode(locale),
          await breadcrumbs(locale, [{ name: nav("about"), href: "/haqqimizda" }]),
        ]}
      />
    </>
  );
}
