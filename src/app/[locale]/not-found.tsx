import { useLocale, useTranslations } from "next-intl";

import { PlaceholderFrame } from "@/components/i18n/placeholder-frame";
import { Button } from "@/components/ui/button";
import { getPathname } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  const locale = useLocale();
  return (
    <PlaceholderFrame>
      <h1 className="text-lead-lg text-balance">{t("title")}</h1>
      <p className="text-body text-pretty text-(--t-small)">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button href={getPathname({ href: "/menziller", locale })}>{t("catalogue")}</Button>
        <Button href={getPathname({ href: "/", locale })} variant="secondary">
          {t("home")}
        </Button>
      </div>
    </PlaceholderFrame>
  );
}
