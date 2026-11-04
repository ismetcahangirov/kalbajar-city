import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Localized } from "@/components/home/localized";
import { underlineLinkClass } from "@/components/shell/underline-link";
import { Icon } from "@/components/ui/icon";
import { whatsappHref } from "@/config/contacts";
import { formatPhone, telHref } from "@/i18n/format";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { SiteContacts } from "@/lib/public/site";

const socialKeys = ["instagram", "facebook", "youtube", "tiktok"] as const;

/**
 * Every way to reach the sales office, from `settings.contacts`, in the
 * reference's three columns (pyzhevsky-pages.md §3 `/contacts`): the office
 * with its address, hours and a link to the viewing form; the phones large
 * in the centre as `tel:` links; WhatsApp (with a message typed in), e-mail
 * and the socials on the right. A value the owner has not set yet is left
 * out, not shown empty.
 */
export async function ContactDetails({ contacts }: { contacts: SiteContacts }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Contact");
  const shell = await getTranslations("Shell");
  const socials = socialKeys.flatMap((key) => {
    const href = contacts.socials[key];
    return href ? [{ key, href }] : [];
  });

  return (
    <div className="grid gap-u4 desk:grid-cols-3 desk:items-end">
      <div className="flex flex-col gap-u">
        <p className="text-label text-(--t-small) uppercase">{t("office")}</p>
        {contacts.address && (
          <address className="text-body not-italic">
            <span className="sr-only">{t("address")}: </span>
            <Localized text={contacts.address} />
          </address>
        )}
        {contacts.hours && (
          <p className="text-body whitespace-pre-line">
            <span className="sr-only">{t("hours")}: </span>
            <Localized text={contacts.hours} />
          </p>
        )}
        <a
          href={`${getPathname({ href: "/elaqe", locale })}#baxis`}
          className={underlineLinkClass("self-start text-label uppercase")}
        >
          {t("book")}
        </a>
      </div>

      <div className="flex flex-col items-start gap-u desk:items-center">
        <p className="sr-only">{t("phones")}</p>
        <ul className="flex flex-col desk:items-center">
          {contacts.phones.map((phone) => (
            <li key={phone}>
              <a
                href={telHref(phone)}
                data-track="click_call"
                className="inline-flex min-h-target items-center text-lead-lg whitespace-nowrap underline-offset-8 hover:underline"
              >
                {formatPhone(phone)}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <ul className="flex flex-col items-start gap-x-u2 desk:items-end">
        {contacts.whatsapp && (
          <li>
            <a
              href={whatsappHref(contacts.whatsapp, shell("whatsappMessage"))}
              data-track="click_whatsapp"
              rel="noopener noreferrer"
              className={underlineLinkClass("text-label uppercase")}
            >
              {t("whatsappChat")}
            </a>
          </li>
        )}
        {contacts.email && (
          <li>
            <a
              href={`mailto:${contacts.email}`}
              className={underlineLinkClass("text-label break-all uppercase")}
            >
              <span className="sr-only">{t("email")}: </span>
              {contacts.email}
            </a>
          </li>
        )}
        {socials.map(({ key, href }) => (
          <li key={key}>
            <a
              href={href}
              rel="noopener noreferrer"
              className={underlineLinkClass("text-label uppercase")}
            >
              {t(`social.${key}`)}
              <Icon icon={ArrowUpRight} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
