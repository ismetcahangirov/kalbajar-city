import { getTranslations } from "next-intl/server";

import { PlaceholderFrame } from "@/components/i18n/placeholder-frame";
import { Heading, Text } from "@/components/ui";

// Placeholder until the apartment page issue (#18) lands. It exists so the
// locale switcher can be shown to keep an apartment's slug.

// Rendered per request and sent complete, not streamed behind Suspense
// (CLAUDE.md → Data and state); the slug is only known at request time.
export const instant = false;

export default async function ApartmentPage({ params }: PageProps<"/[locale]/menziller/[slug]">) {
  const { slug } = await params;
  const t = await getTranslations("Apartment");
  return (
    <PlaceholderFrame>
      <Heading as="h1" size="display" align="center">
        {t("title", { slug })}
      </Heading>
      <Text tone="muted">{t("placeholder")}</Text>
    </PlaceholderFrame>
  );
}
