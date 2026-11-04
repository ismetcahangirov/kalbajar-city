import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { HomeScene } from "@/components/home/scenes/home-scene";
import { complexNode, StructuredData } from "@/components/seo/structured-data";
import { Preloader } from "@/components/shell/preloader";
import type { Locale } from "@/i18n/routing";
import { getHomePage } from "@/lib/public/home";
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
  const faq = sections.find((section) => section.kind === "faq");

  return (
    <>
      {/* First, so its inline script decides before anything paints. */}
      <Preloader />
      {/* Hero first; the console's order decides the rest. */}
      {[...sections]
        .sort((a, b) => Number(b.kind === "hero") - Number(a.kind === "hero"))
        .map((section) => (
          <HomeScene key={section.kind} section={section} locale={locale} />
        ))}
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
