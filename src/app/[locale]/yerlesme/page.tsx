import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Localized } from "@/components/home/localized";
import { GridLines } from "@/components/motion/grid-lines";
import { Reveal } from "@/components/motion/reveal";
import { PageHero } from "@/components/pages/page-hero";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { ChapterTabs, type ChapterTab } from "@/components/shell/chapter-tabs";
import { NextChapter } from "@/components/shell/next-chapter";
import { MapBlock } from "@/components/site/map-block";
import { ArrowBlock } from "@/components/ui/arrow-block";
import { defaultImage } from "@/content/defaults";
import { formatNumber } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getLocationPage, getSiteContacts } from "@/lib/public/site";
import { pageMetadata } from "@/lib/seo/page-metadata";

// Reads the console's location copy and settings per request and sends the
// page complete (CLAUDE.md → Data and state).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Location");
  // The geo meta, with the coordinates once confirmed, comes from pageMetadata.
  return pageMetadata({
    locale,
    href: "/yerlesme",
    title: nav("location"),
    description: t("description"),
  });
}

/**
 * `/yerlesme` after the reference's `/location`: the split title over the
 * place, the statement between four grid lines, the distances as outlined
 * boxes, how to get there, and the map (only once the owner has confirmed
 * the coordinates, #7). Distances, directions and the map image come from
 * the home page's location section.
 */
export default async function LocationPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const [location, contacts] = await Promise.all([
    getLocationPage(locale),
    getSiteContacts(locale),
  ]);
  const nav = await getTranslations("Navigation");
  const words = await getTranslations("Pages.words");
  const shell = await getTranslations("Shell");
  const t = await getTranslations("Location");
  const { coordinates } = contacts;

  const tabs: ChapterTab[] = [
    ...(location.body ? [{ id: "mekan", label: t("tabs.statement") }] : []),
    ...(location.distances.length ? [{ id: "mesafeler", label: t("tabs.distances") }] : []),
    { id: "yol", label: t("tabs.directions") },
    ...(coordinates ? [{ id: "xerite", label: t("tabs.map") }] : []),
  ];

  return (
    <>
      <PageHero
        title={nav("location")}
        word={words("location")}
        subtitle={t("lead")}
        next={tabs[0]!.id}
        theme="sand"
        layout="framed"
        image={defaultImage("page.yerlesme", locale)}
      />

      {location.body && (
        <section
          id="mekan"
          data-theme="light"
          aria-labelledby="mekan-basliq"
          className="relative isolate flex min-h-[80svh] flex-col items-center justify-center gap-u2 bg-(--t-bg) px-layout py-u9 text-center text-(--t-text)"
        >
          <GridLines variant="quarters" draw />
          <h2 id="mekan-basliq" className="text-label text-(--t-small) uppercase">
            {t("tabs.statement")}
          </h2>
          <Reveal kind="text" as="p" className="max-w-[45rem] text-lead-lg">
            <Localized text={location.body} />
          </Reveal>
        </section>
      )}

      {location.distances.length > 0 && (
        <section
          id="mesafeler"
          data-theme="dark"
          aria-labelledby="mesafeler-basliq"
          className="flex flex-col gap-u6 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <h2
            id="mesafeler-basliq"
            className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
          >
            {t("distances")}
          </h2>
          {/* The reference's outlined category boxes: name top-left, time bottom-right. */}
          <Reveal
            kind="clip-down"
            group
            as="dl"
            className="grid gap-u desk:grid-cols-2 lg:grid-cols-4"
          >
            {location.distances.map((d) => (
              <div
                key={d.place.value}
                className="flex min-h-[8.75rem] flex-col justify-between gap-u2 border border-(--t-line-alt) p-u"
              >
                <dt className="text-label uppercase">
                  <Localized text={d.place} />
                </dt>
                <dd className="self-end text-lead whitespace-nowrap">
                  {t("minutes", { minutes: formatNumber(d.minutes, locale) })}
                </dd>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      <section
        id="yol"
        data-theme="sand"
        aria-labelledby="yol-basliq"
        className="relative isolate grid grid-cols-1 gap-u4 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:grid-cols-3 desk:py-u9"
      >
        <GridLines variant="thirds" />
        <h2
          id="yol-basliq"
          className="text-title break-words hyphens-auto text-(--t-primary) uppercase"
        >
          {t("directions")}
        </h2>
        <div className="flex flex-col gap-u2 desk:col-span-2 desk:ps-u">
          {contacts.address && (
            <address className="text-lead not-italic">
              <Localized text={contacts.address} />
            </address>
          )}
          <p className="max-w-(--container-prose) text-body whitespace-pre-line">
            {location.directions ? (
              <Localized text={location.directions} />
            ) : (
              t("directionsDefault")
            )}
          </p>
          <ArrowBlock
            as="a"
            href={`${getPathname({ href: "/elaqe", locale })}#baxis`}
            tone="ink"
            className="mt-u2"
          >
            {t("viewing")}
          </ArrowBlock>
        </div>
      </section>

      {coordinates && (
        <section
          id="xerite"
          data-theme="light"
          aria-labelledby="xerite-basliq"
          className="flex flex-col gap-u2 bg-(--t-bg) px-layout py-u6 text-(--t-text) desk:py-u9"
        >
          <h2 id="xerite-basliq" className="text-label text-(--t-small) uppercase">
            {t("map")}
          </h2>
          <MapBlock coordinates={coordinates} image={location.map} />
        </section>
      )}

      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: nav("location"), href: "/yerlesme" }])]}
      />
      {tabs.length > 1 && <ChapterTabs label={shell("sections")} tabs={tabs} />}
      <NextChapter current="/yerlesme" />
    </>
  );
}
