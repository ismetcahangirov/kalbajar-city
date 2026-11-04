import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { mainPhone } from "@/config/contacts";
import { formatPhone, telHref } from "@/i18n/format";

import { Burger } from "./burger";
import { HeaderFrame } from "./header-frame";
import { RollLink } from "./roll-link";
import { BrandLink } from "./wordmark";

/**
 * The fixed header (ui-kit.md → Chrome, reference pyzhevsky-pages.md §1.3).
 * From lg: burger and "MƏNZİL SEÇ" left, the wordmark centred, the phone
 * (from xl), "MÜRACİƏT ET" and the languages right. Below lg: the wordmark
 * left, a call button and the burger right; the languages live in the menu.
 * On the home page's phones the number stands where the wordmark will fade
 * in (A8). "MÜRACİƏT ET" opens the inquiry dialog, or without script leads
 * to the contact page and its forms.
 */
export function Header() {
  const t = useTranslations("Shell");
  const phone = formatPhone(mainPhone);
  return (
    <HeaderFrame>
      <span aria-hidden="true" data-header-layer="" className="absolute inset-0" />

      <div className="relative flex h-full items-center justify-between gap-u px-layout lg:hidden">
        <div className="relative flex items-center">
          <BrandLink data-header-logo="" />
          <a
            href={telHref(mainPhone)}
            data-track="click_call"
            data-header-phone-text=""
            className="absolute inset-y-0 start-0 items-center text-label whitespace-nowrap"
          >
            {phone}
          </a>
        </div>
        <div className="flex items-center gap-u">
          <a
            href={telHref(mainPhone)}
            data-track="click_call"
            aria-label={t("call")}
            className="grid size-target place-items-center text-(--t-text)"
          >
            <Phone width={16} height={16} strokeWidth={1.5} aria-hidden focusable={false} />
          </a>
          <Burger />
        </div>
      </div>

      <div className="relative hidden h-full grid-cols-[1fr_auto_1fr] items-center gap-u2 px-layout lg:grid">
        <div className="flex items-center gap-u3">
          <Burger />
          <RollLink href="/menziller" label={t("chooseApartment")} data-nav-href="/menziller" />
        </div>
        <BrandLink data-header-logo="" />
        <div className="flex items-center justify-end gap-u2">
          <RollLink
            as="a"
            href={telHref(mainPhone)}
            data-track="click_call"
            label={phone}
            className="hidden xl:inline-flex"
          />
          <RollLink href="/elaqe" label={t("inquire")} data-dialog-open="inquiry" />
          <LocaleSwitcher className="-me-3" />
        </div>
      </div>
    </HeaderFrame>
  );
}
