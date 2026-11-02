import { ArrowUpRight, Mail, MessageCircle, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Localized } from "@/components/home/localized";
import { underlineLinkClass } from "@/components/shell/link-class";
import { Icon } from "@/components/ui";
import { whatsappHref } from "@/config/contacts";
import { formatPhone, telHref } from "@/i18n/format";
import type { SiteContacts } from "@/lib/public/site";

const socialKeys = ["instagram", "facebook", "youtube", "tiktok"] as const;

/**
 * Every way to reach the sales office, from `settings.contacts`: phones as
 * `tel:` links, WhatsApp with a message typed in, e-mail, address and office
 * hours. A value the owner has not set yet is left out, not shown empty.
 */
export async function ContactDetails({ contacts }: { contacts: SiteContacts }) {
  const t = await getTranslations("Contact");
  const shell = await getTranslations("Shell");
  const socials = socialKeys.flatMap((key) => {
    const href = contacts.socials[key];
    return href ? [{ key, href }] : [];
  });

  return (
    <dl className="flex flex-col">
      <Row label={t("phones")}>
        <ul className="flex flex-col">
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
        </ul>
      </Row>
      {contacts.whatsapp && (
        <Row label={shell("whatsapp")}>
          <a
            href={whatsappHref(contacts.whatsapp, shell("whatsappMessage"))}
            data-track="click_whatsapp"
            rel="noopener noreferrer"
            className={underlineLinkClass()}
          >
            <Icon icon={MessageCircle} />
            {t("whatsappChat")}
          </a>
        </Row>
      )}
      {contacts.email && (
        <Row label={t("email")}>
          <a href={`mailto:${contacts.email}`} className={underlineLinkClass("break-all")}>
            <Icon icon={Mail} />
            {contacts.email}
          </a>
        </Row>
      )}
      {contacts.address && (
        <Row label={t("address")}>
          <address className="py-2 not-italic">
            <Localized text={contacts.address} />
          </address>
        </Row>
      )}
      {contacts.hours && (
        <Row label={t("hours")}>
          <p className="py-2 whitespace-pre-line">
            <Localized text={contacts.hours} />
          </p>
        </Row>
      )}
      {socials.length > 0 && (
        <Row label={t("socials")}>
          <ul className="flex flex-wrap gap-x-6">
            {socials.map(({ key, href }) => (
              <li key={key}>
                <a href={href} rel="noopener noreferrer" className={underlineLinkClass()}>
                  {t(`social.${key}`)}
                  <Icon icon={ArrowUpRight} />
                </a>
              </li>
            ))}
          </ul>
        </Row>
      )}
    </dl>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-4">
      <dt className="text-small text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
