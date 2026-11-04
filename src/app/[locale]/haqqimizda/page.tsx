import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Localized } from "@/components/home/localized";
import { GridLines } from "@/components/motion/grid-lines";
import { Reveal } from "@/components/motion/reveal";
import { Scrub } from "@/components/motion/scrub";
import { PageHero } from "@/components/pages/page-hero";
import { breadcrumbs, complexNode, StructuredData } from "@/components/seo/structured-data";
import { ChapterTabs, type ChapterTab } from "@/components/shell/chapter-tabs";
import { NextChapter } from "@/components/shell/next-chapter";
import { underlineLinkClass } from "@/components/shell/underline-link";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { Picture } from "@/components/ui/picture";
import { defaultImage } from "@/content/defaults";
import { formatArea, formatNumber, unitSymbol } from "@/i18n/format";
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
 * The growing portrait (A21's window expand with the reference's measured
 * sizes): the 700 × 545 frame opens from a centred 240 × 325 window while
 * the section scrolls up to the top of the viewport.
 */
const portrait = { from: "inset(20.2% 32.9%)", to: "inset(0% 0%)" } as const;

/**
 * `/haqqimizda` after the reference's `/about`: the split-title hero, the
 * quiet section (the home page's about copy with the growing portrait), the
 * numbers and the facts as sentences, the amenities as outlined boxes and
 * the developer's card. The copy comes from the console's settings and the
 * home about section, so each fact is edited in one place.
 */
export default async function AboutPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const page = await getAboutPage(locale);
  const nav = await getTranslations("Navigation");
  const words = await getTranslations("Pages.words");
  const t = await getTranslations("About");
  const facts = await getTranslations("About.facts");
  const sentences = page.facts
    ? factSentences(page.facts, page.developer.name, locale, {
        layouts: page.layouts,
        address: page.address,
      })
    : [];
  const numbers = page.facts
    ? [
        { key: "apartments" as const, value: formatNumber(page.facts.apartments, locale) },
        { key: "buildings" as const, value: formatNumber(page.facts.buildings, locale) },
        { key: "blocks" as const, value: formatNumber(page.facts.blocks, locale) },
        { key: "parking" as const, value: formatNumber(page.facts.parkingSpaces, locale) },
        { key: "area" as const, value: formatArea(Number(page.facts.totalArea), locale) },
        {
          key: "land" as const,
          value: `${formatNumber(Number(page.facts.landHectares), locale, { maximumFractionDigits: 2 })} ${unitSymbol("ha", locale)}`,
        },
      ]
    : [];
  const developerLinks = [
    { key: "website", href: page.developer.website },
    { key: "instagram", href: page.developer.instagram },
  ] as const;

  const tabs: ChapterTab[] = [
    ...(page.intro ? [{ id: "layihe", label: t("tabs.intro") }] : []),
    ...(sentences.length ? [{ id: "qisaca", label: t("tabs.facts") }] : []),
    ...(page.amenities.length ? [{ id: "ustunlukler", label: t("tabs.amenities") }] : []),
    { id: "tikintici", label: t("tabs.developer") },
  ];
  const shell = await getTranslations("Shell");

  return (
    <>
      <PageHero
        title={nav("about")}
        word={words("about")}
        subtitle={t("lead")}
        next={tabs[0]!.id}
        theme="dark"
        layout="photo"
        image={defaultImage("page.haqqimizda", locale)}
      />

      {page.intro && (
        <section
          id="layihe"
          data-theme="light"
          aria-labelledby="layihe-basliq"
          className="relative isolate flex flex-col gap-u6 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <GridLines variant="half" draw />
          <div className="flex flex-col gap-u2 desk:w-1/2 desk:pe-u2">
            {page.intro.eyebrow && (
              <p className="text-label text-(--t-small) uppercase">
                <Localized text={page.intro.eyebrow} />
              </p>
            )}
            <h2
              id="layihe-basliq"
              className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
            >
              <Localized text={page.intro.title} />
            </h2>
            <Reveal kind="text" as="p" className="text-lead text-(--t-text)">
              <Localized text={page.intro.body} />
            </Reveal>
          </div>
          <div className="relative mx-auto aspect-[700/545] w-full max-w-[43.75rem]">
            <Scrub
              range="100-0 → 0-0"
              easing="quadOut"
              from={{ clipPath: portrait.from }}
              to={{ clipPath: portrait.to }}
              className="relative size-full"
            >
              <Picture image={page.intro.image} sizes="(width >= 41.75rem) 43.75rem, 100vw" />
            </Scrub>
          </div>
        </section>
      )}

      {sentences.length > 0 && (
        <section
          id="qisaca"
          data-theme="dark"
          aria-labelledby="faktlar"
          className="relative isolate flex flex-col gap-u6 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <GridLines variant="thirds" draw />
          <h2
            id="faktlar"
            className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
          >
            {t("factsTitle")}
          </h2>
          {numbers.length > 0 && (
            <dl
              aria-label={t("numbersTitle")}
              className="grid grid-cols-1 border-t border-(--t-line-alt) min-[24rem]:grid-cols-2 desk:grid-cols-3"
            >
              {numbers.map(({ key, value }) => (
                <div
                  key={key}
                  className="flex flex-col-reverse gap-u border-b border-(--t-line-alt) py-u2 pe-u"
                >
                  <dt className="text-label text-(--t-small) uppercase">{t(`numbers.${key}`)}</dt>
                  <dd className="text-numeral whitespace-nowrap">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {/* Plain sentences, each true on its own, so they can be quoted as they are. */}
          <ul className="flex flex-col desk:ms-[33.333%] desk:ps-u">
            {sentences.map((sentence) => (
              <li key={sentence.key} className="border-t border-(--t-line-alt) py-u text-body">
                {/* The values match each message's arguments; tests/unit/facts.test.ts renders them all. */}
                {facts(sentence.key, sentence.values as never)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.amenities.length > 0 && (
        <section
          id="ustunlukler"
          data-theme="dark-alt"
          aria-labelledby="ustunlukler-basliq"
          className="flex flex-col gap-u6 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <h2
            id="ustunlukler-basliq"
            className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
          >
            {t("amenities")}
          </h2>
          <Reveal
            kind="clip-down"
            group
            as="ul"
            className="grid gap-u desk:grid-cols-2 lg:grid-cols-4"
          >
            {page.amenities.map((item) => (
              <li
                key={item.icon + item.title.value}
                className="flex min-h-[8.75rem] flex-col justify-between gap-u2 border border-(--t-line-alt) p-u"
              >
                <h3 className="text-label uppercase">
                  <Localized text={item.title} />
                </h3>
                {item.body && (
                  <p className="text-body">
                    <Localized text={item.body} />
                  </p>
                )}
              </li>
            ))}
          </Reveal>
        </section>
      )}

      <section
        id="tikintici"
        data-theme="sand"
        aria-labelledby="tikintici-basliq"
        className="relative isolate grid grid-cols-1 gap-u6 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:grid-cols-3 desk:py-u9"
      >
        <GridLines variant="thirds" />
        {/* The team card of the reference: role on top, the name in the middle, links below. */}
        <div
          data-theme="light"
          className="flex aspect-[2/3] max-h-[30rem] w-full max-w-[20rem] flex-col justify-between bg-(--t-bg) p-u2 text-(--t-text)"
        >
          <p className="text-label text-(--t-small) uppercase">{t("developer.eyebrow")}</p>
          <h2 id="tikintici-basliq" className="text-center text-lead">
            {page.developer.name}
          </h2>
          <ul className="flex flex-wrap gap-x-u2">
            {developerLinks.map(({ key, href }) =>
              href ? (
                <li key={key}>
                  <a href={href} rel="noopener noreferrer" className={underlineLinkClass()}>
                    {t(`developer.${key}`)}
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        </div>
        <div className="flex flex-col justify-end gap-u4 desk:col-span-2 desk:ps-u">
          <Reveal kind="text" as="p" className="max-w-[40rem] text-lead">
            {t("developer.body", { developer: page.developer.name })}
          </Reveal>
          <div className="flex flex-col gap-u desk:flex-row">
            <ArrowBlock as="link" href="/menziller" tone="ink">
              {t("apartments")}
            </ArrowBlock>
            <ArrowBlock as="a" href={`${getPathname({ href: "/elaqe", locale })}#baxis`}>
              {t("viewing")}
            </ArrowBlock>
          </div>
        </div>
      </section>

      <StructuredData
        locale={locale}
        nodes={[
          await complexNode(locale),
          await breadcrumbs(locale, [{ name: nav("about"), href: "/haqqimizda" }]),
        ]}
      />
      {tabs.length > 1 && <ChapterTabs label={shell("sections")} tabs={tabs} />}
      <NextChapter current="/haqqimizda" />
    </>
  );
}
