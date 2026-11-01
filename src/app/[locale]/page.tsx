import { useTranslations } from "next-intl";

import { PlaceholderFrame } from "@/components/i18n/placeholder-frame";
import { Heading, Text } from "@/components/ui";

// Placeholder until the home page issue (#17) lands.
export default function Home() {
  const t = useTranslations("Home");
  return (
    <PlaceholderFrame>
      <Heading as="h1" size="display-xl" align="center">
        {t("title")}
      </Heading>
      <Text size="body-lg" tone="muted">
        {t("tagline")}
      </Text>
    </PlaceholderFrame>
  );
}
