import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ComplexSelector } from "@/components/complex/complex-selector";
import { GridLines } from "@/components/motion/grid-lines";
import { Reveal } from "@/components/motion/reveal";
import { PageHero } from "@/components/pages/page-hero";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { ChapterTabs } from "@/components/shell/chapter-tabs";
import { NextChapter } from "@/components/shell/next-chapter";
import { defaultImage } from "@/content/defaults";
import { formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { getComplexSelector } from "@/lib/public/complex";
import { pageMetadata } from "@/lib/seo/page-metadata";
import {
  blockApartments,
  hasSelectionParams,
  resolveSelection,
  statusCounts,
} from "@/shared/complex";

// The selection is read from searchParams, so the page renders per request
// and is sent complete. The inventory loader is cached and tagged.
export const instant = false;

export async function generateMetadata({
  searchParams,
}: PageProps<"/[locale]/kompleks">): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Complex");
  // A selection is a view of the page, not a page of its own.
  return pageMetadata({
    locale,
    href: "/kompleks",
    title: t("title"),
    description: t("description"),
    indexable: !hasSelectionParams(await searchParams),
  });
}

/**
 * `/kompleks` after the reference's `/architecture` and its selector: the
 * split title over the complex's portrait, numeral cards between four grid
 * lines, then the interactive complex selector in the hairline language
 * (its links, plan and lists work as before).
 */
export default async function ComplexPage({ searchParams }: PageProps<"/[locale]/kompleks">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Complex");
  const words = await getTranslations("Pages.words");
  const shell = await getTranslations("Shell");
  const data = await getComplexSelector(locale);
  const selection = resolveSelection(data, await searchParams);

  const apartments = data.blocks.flatMap(blockApartments);
  const counts = statusCounts(apartments);
  const floors = Math.max(0, ...data.blocks.map((block) => block.floors.length));
  const numbers = data.blocks.length
    ? [
        { key: "blocks" as const, value: data.blocks.length },
        { key: "floors" as const, value: floors },
        { key: "apartments" as const, value: counts.total },
        { key: "available" as const, value: counts.available },
      ]
    : [];

  return (
    <>
      <PageHero
        title={t("title")}
        word={words("complex")}
        subtitle={t("lead")}
        next={numbers.length ? "reqemler" : "secim"}
        theme="light"
        layout="framed"
        image={defaultImage("page.kompleks", locale)}
      />

      {numbers.length > 0 && (
        <section
          id="reqemler"
          data-theme="sand"
          aria-labelledby="reqemler-basliq"
          className="relative isolate flex flex-col gap-u6 bg-(--t-bg) py-u6 text-(--t-text) desk:py-u9"
        >
          <GridLines variant="quarters" draw />
          <h2
            id="reqemler-basliq"
            className="px-layout text-center text-title break-words hyphens-auto text-(--t-primary) uppercase"
          >
            {t("numbersTitle")}
          </h2>
          {/* Numeral cards (reference /architecture): the number large, its caption below. */}
          <Reveal kind="clip-up" group as="dl" className="grid grid-cols-2 desk:grid-cols-4">
            {numbers.map(({ key, value }) => (
              <div
                key={key}
                className="flex flex-col-reverse items-center gap-u px-layout py-u4 text-center"
              >
                <dt className="text-label text-(--t-small) uppercase">{t(`numbers.${key}`)}</dt>
                <dd className="text-word">{formatNumber(value, locale)}</dd>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      <section
        id="secim"
        data-theme="light"
        aria-label={t("tabs.selector")}
        className="relative isolate bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
      >
        <ComplexSelector data={data} selection={selection} locale={locale} />
      </section>

      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/kompleks" }])]}
      />
      {numbers.length > 0 && (
        <ChapterTabs
          label={shell("sections")}
          tabs={[
            { id: "reqemler", label: t("tabs.numbers") },
            { id: "secim", label: t("tabs.selector") },
          ]}
        />
      )}
      <NextChapter current="/kompleks" />
    </>
  );
}
