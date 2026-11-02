import { ArrowUpRight, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { Icon } from "@/components/ui";
import { contacts, whatsappHref } from "@/config/contacts";
import { formatPhone, telHref } from "@/i18n/format";
import { cx } from "@/lib/cx";

import { underlineLinkClass } from "./link-class";

/** Phones, WhatsApp and Instagram, for the mobile menu and the footer. */
export function ContactList({ className }: { className?: string }) {
  const t = useTranslations("Shell");
  return (
    <ul className={cx("flex flex-col", className)}>
      {contacts.phones.map((phone) => (
        <li key={phone}>
          <a
            href={telHref(phone)}
            data-track="click_call"
            className={underlineLinkClass("whitespace-nowrap")}
          >
            <Icon icon={Phone} />
            {formatPhone(phone)}
          </a>
        </li>
      ))}
      <li>
        <a
          href={whatsappHref(contacts.whatsapp, t("whatsappMessage"))}
          data-track="click_whatsapp"
          rel="noopener noreferrer"
          className={underlineLinkClass()}
        >
          <Icon icon={MessageCircle} />
          {t("whatsapp")}
        </a>
      </li>
      <li>
        <a href={contacts.instagram} rel="noopener noreferrer" className={underlineLinkClass()}>
          <Icon icon={ArrowUpRight} />
          {t("instagram")}
        </a>
      </li>
    </ul>
  );
}
