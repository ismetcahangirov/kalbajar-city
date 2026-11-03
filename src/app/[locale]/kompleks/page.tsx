import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { ComplexSelector } from "@/components/complex/complex-selector";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { Container, Heading, Text } from "@/components/ui";
import type { Locale } from "@/i18n/routing";
import { getComplexSelector } from "@/lib/public/complex";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { hasSelectionParams, resolveSelection } from "@/shared/complex";

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

export default async function ComplexPage({ searchParams }: PageProps<"/[locale]/kompleks">) {
  await connection();
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Complex");
  const data = await getComplexSelector(locale);
  const selection = resolveSelection(data, await searchParams);

  return (
    <Container className="flex flex-col gap-block pt-block pb-section">
      <header className="flex flex-col gap-4">
        <Heading as="h1" size="display">
          {t("title")}
        </Heading>
        <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
          {t("lead")}
        </Text>
      </header>
      <ComplexSelector data={data} selection={selection} locale={locale} />
      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: t("title"), href: "/kompleks" }])]}
      />
    </Container>
  );
}
