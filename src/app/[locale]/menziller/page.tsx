import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PlaceholderFrame } from "@/components/i18n/placeholder-frame";
import { Heading, Text } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Apartments");
  return { title: t("title") };
}

// Placeholder until the apartment catalogue issue (#18) lands.
export default function ApartmentsPage() {
  const t = useTranslations("Apartments");
  return (
    <PlaceholderFrame>
      <Heading as="h1" size="display" align="center">
        {t("title")}
      </Heading>
      <Text tone="muted">{t("placeholder")}</Text>
    </PlaceholderFrame>
  );
}
