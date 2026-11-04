import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { RoundButton } from "@/components/ui/round-button";
import { whatsappHref } from "@/config/contacts";
import type { SiteContacts } from "@/lib/public/site";

import { FixedButtonsFrame } from "./fixed-buttons-frame";

/**
 * The fixed round button at the bottom right (reference pyzhevsky-pages.md
 * §1.5): WhatsApp, when a number is configured, so the chat is one tap away
 * on every page (the call is in the header). It takes the theme of the
 * section under it, carries the one public shadow, rises above the locale
 * suggestion and fades out over the footer, which lists the same contact.
 * The number comes from the console's settings (#27).
 */
export function FixedButtons({ contacts }: { contacts: SiteContacts }) {
  const t = useTranslations("Shell");
  if (!contacts.whatsapp) return null;
  return (
    <FixedButtonsFrame>
      <RoundButton
        as="a"
        href={whatsappHref(contacts.whatsapp, t("whatsappMessage"))}
        data-track="click_whatsapp"
        rel="noopener noreferrer"
        label={t("whatsapp")}
        icon={
          <MessageCircle width={16} height={16} strokeWidth={1.5} aria-hidden focusable={false} />
        }
        tone="ink"
        className="text-(--t-bg)! drop-shadow-button [--round-button-border:var(--t-text)]! [--round-button-fill:var(--t-text)]!"
      />
    </FixedButtonsFrame>
  );
}
