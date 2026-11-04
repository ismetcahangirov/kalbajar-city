import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { Hero } from "@/components/home/hero";
import {
  About,
  Amenities,
  CardZoom,
  Construction,
  Cta,
  Faq,
  Layouts,
  Location,
  Process,
  Stats,
} from "@/components/home/sections";
import { complexNode, StructuredData } from "@/components/seo/structured-data";
import { Preloader } from "@/components/shell/preloader";
import type { Tone } from "@/components/ui";
import type { Locale } from "@/i18n/routing";
import { getHomePage, type HomeSection } from "@/lib/public/home";
import { faqNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/page-metadata";

// Reads the database per request and sends the page complete, not streamed
// behind Suspense (CLAUDE.md → Data and state). The data itself is cached and
// tagged, so a request costs a cache read until the console changes it.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Metadata");
  // The geo meta, with the coordinates once confirmed, comes from pageMetadata.
  return pageMetadata({
    locale,
    href: "/",
    title: t("title"),
    absoluteTitle: true,
    description: t("description"),
  });
}

export default async function Home() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const sections = await getHomePage(locale);
  const hero = sections.find((section) => section.kind === "hero");
  const rest = sections.filter((section) => section.kind !== "hero");
  const faq = sections.find((section) => section.kind === "faq");

  return (
    <>
      {/* First, so its inline script decides before anything paints. */}
      <Preloader />
      {hero && <Hero {...hero} />}
      {rest.map((section, i) =>
        // Surfaces alternate paper and limestone and heads alternate start
        // and centre (ui-kit → Spacing and layout), whatever the order.
        renderSection(
          section,
          i % 2 === 0 ? "paper" : "limestone",
          i % 2 === 0 ? "start" : "center",
        ),
      )}
      {/* The FAQ as it is shown, word for word (spec §6). */}
      <StructuredData
        locale={locale}
        nodes={[
          await complexNode(locale),
          faq
            ? faqNode(
                faq.items.map((item) => ({
                  question: item.question.value,
                  answer: item.answer.value,
                })),
              )
            : null,
        ]}
      />
    </>
  );
}

function renderSection(section: HomeSection, tone: Tone, align: "start" | "center") {
  const key = section.kind;
  switch (section.kind) {
    case "hero":
      return null;
    case "stats":
      return <Stats key={key} {...section} tone={tone} align={align} />;
    case "about":
      return <About key={key} {...section} tone={tone} align={align} />;
    case "layouts":
      return <Layouts key={key} {...section} tone={tone} align={align} />;
    case "amenities":
      return <Amenities key={key} {...section} tone={tone} align={align} />;
    case "card_zoom":
      return <CardZoom key={key} {...section} tone={tone} align={align} />;
    case "location":
      return <Location key={key} {...section} tone={tone} align={align} />;
    case "construction":
      return <Construction key={key} {...section} tone={tone} align={align} />;
    case "process":
      return <Process key={key} {...section} tone={tone} align={align} />;
    case "faq":
      return <Faq key={key} {...section} tone={tone} align={align} />;
    case "cta":
      return <Cta key={key} {...section} tone={tone} align={align} />;
  }
}
