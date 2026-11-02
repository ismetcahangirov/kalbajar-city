import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { Button, Container, Icon } from "@/components/ui";
import { mainPhone } from "@/config/contacts";
import { telHref } from "@/i18n/format";

import { HeaderFrame } from "./header-frame";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { primaryNav } from "./navigation";
import { BrandLink } from "./wordmark";

/**
 * Wordmark, primary navigation, locale switcher and the call button from
 * `lg`; wordmark and the menu button below it, where the action bar carries
 * the call.
 */
export function Header() {
  const t = useTranslations("Shell");
  return (
    <HeaderFrame>
      <Container className="relative flex h-full items-center justify-between gap-6">
        <BrandLink />
        <NavLinks items={primaryNav} variant="bar" className="hidden lg:block" />
        <div className="flex items-center gap-2 xl:gap-4">
          <LocaleSwitcher className="hidden lg:block" />
          {/* A wrapper, because `hidden` cannot override the button's own display. */}
          <div className="hidden lg:block">
            <Button
              href={telHref(mainPhone)}
              data-track="click_call"
              variant="secondary"
              leadingIcon={<Icon icon={Phone} />}
              className="px-3.5 xl:px-6"
            >
              {/* Icon only below xl, where Russian labels fill the row. */}
              <span className="sr-only xl:not-sr-only">{t("call")}</span>
            </Button>
          </div>
          <MobileMenu />
        </div>
      </Container>
    </HeaderFrame>
  );
}
