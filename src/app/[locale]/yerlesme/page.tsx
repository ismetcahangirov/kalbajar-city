import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Localized } from "@/components/home/localized";
import { FadeUp } from "@/components/motion";
import { MapBlock } from "@/components/site/map-block";
import { PageHead } from "@/components/site/page-head";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { Button, Container, Heading, Icon, Section, Text } from "@/components/ui";
import { formatNumber } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { getLocationPage, getSiteContacts } from "@/lib/public/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { NextChapter } from "@/components/shell/next-chapter";

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
 * Where the complex is: distances to the places a buyer knows, how to get
 * there, and the map. Distances, directions and the map image come from the
 * home page's location section; the map itself needs the coordinates the
 * owner has not confirmed yet (#7), and without them the page has none.
 */
export default async function LocationPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const [location, contacts] = await Promise.all([
    getLocationPage(locale),
    getSiteContacts(locale),
  ]);
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Location");
  const { coordinates } = contacts;

  return (
    <>
      <PageHead
        title={nav("location")}
        lead={location.body ? <Localized text={location.body} /> : t("lead")}
      />
      <Section tone="limestone" aria-label={t("details")}>
        <Container className={cx("grid gap-block", coordinates && "lg:grid-cols-2 lg:gap-gutter")}>
          <div className="flex flex-col gap-block">
            {location.distances.length > 0 && (
              <FadeUp className="flex flex-col gap-6">
                <Heading as="h2" id="mesafeler" size="heading">
                  {t("distances")}
                </Heading>
                <dl aria-labelledby="mesafeler" className="flex flex-col">
                  {location.distances.map((d) => (
                    <div
                      key={d.place.value}
                      className="flex items-baseline justify-between gap-4 border-t border-border py-4"
                    >
                      <dt>
                        <Localized text={d.place} />
                      </dt>
                      <dd className="text-end text-text-muted">
                        {t("minutes", { minutes: formatNumber(d.minutes, locale) })}
                      </dd>
                    </div>
                  ))}
                </dl>
              </FadeUp>
            )}
            <FadeUp className="flex flex-col gap-4">
              <Heading as="h2" size="heading">
                {t("directions")}
              </Heading>
              {contacts.address && (
                <address className="text-body-lg not-italic">
                  <Localized text={contacts.address} />
                </address>
              )}
              <Text className="max-w-(--container-prose) whitespace-pre-line">
                {location.directions ? (
                  <Localized text={location.directions} />
                ) : (
                  t("directionsDefault")
                )}
              </Text>
              <div>
                <Button
                  href={`${getPathname({ href: "/elaqe", locale })}#baxis`}
                  variant="secondary"
                  trailingIcon={<Icon icon={ArrowRight} />}
                >
                  {t("viewing")}
                </Button>
              </div>
            </FadeUp>
          </div>
          {coordinates && (
            <div className="flex flex-col gap-6">
              <Heading as="h2" size="heading" className="sr-only">
                {t("map")}
              </Heading>
              <MapBlock coordinates={coordinates} image={location.map} />
            </div>
          )}
        </Container>
      </Section>
      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: nav("location"), href: "/yerlesme" }])]}
      />
      <NextChapter current="/yerlesme" />
    </>
  );
}
