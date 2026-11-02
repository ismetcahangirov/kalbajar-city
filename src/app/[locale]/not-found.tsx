import { useLocale, useTranslations } from "next-intl";

import { PlaceholderFrame } from "@/components/i18n/placeholder-frame";
import { Button, Heading, Text } from "@/components/ui";
import { getPathname } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  const locale = useLocale();
  return (
    <PlaceholderFrame>
      <Heading as="h1" size="display" align="center">
        {t("title")}
      </Heading>
      <Text tone="muted">{t("body")}</Text>
      <div className="flex flex-wrap justify-center gap-3">
        <Button href={getPathname({ href: "/menziller", locale })}>{t("catalogue")}</Button>
        <Button href={getPathname({ href: "/", locale })} variant="secondary">
          {t("home")}
        </Button>
      </div>
    </PlaceholderFrame>
  );
}
