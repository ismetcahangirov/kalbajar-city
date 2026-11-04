import { ArrowUp } from "lucide-react";
import { cacheLife } from "next/cache";
import { useTranslations } from "next-intl";

import { RoundButton } from "@/components/ui/round-button";
import { contacts, whatsappHref } from "@/config/contacts";
import { formatPhone, telHref } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

import { fullNav, privacyLink } from "./navigation";
import { BrandLink } from "./wordmark";

// A company name, the same in every language.
const DEVELOPER = "InCity Projects";

// The year for the copyright line, refreshed daily rather than per request.
async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/**
 * The footer (reference pyzhevsky-pages.md §1.7) on light: the sales office
 * and contacts left, the up button, wordmark and tagline in the centre, the
 * site map right, the legal row below. Its content rises 5svh as it enters
 * (A42, CSS scroll-driven: src/styles/shell.css).
 */
export async function Footer() {
  return <FooterContent year={await currentYear()} />;
}

const label = "text-label text-(--t-text) uppercase";
const smallLink = "underline-link w-fit text-small-t";

function FooterContent({ year }: { year: number }) {
  const t = useTranslations("Shell");
  const nav = useTranslations("Navigation");

  return (
    <footer
      id="site-footer"
      data-theme="light"
      className="relative overflow-hidden bg-(--t-bg) text-(--t-text)"
    >
      <div data-footer-rise="" className="flex flex-col">
        <div className="grid gap-u4 px-layout pt-u2 pb-u4 lg:grid-cols-3 lg:gap-u2 lg:pb-u6">
          <div className="flex flex-col gap-u lg:order-1">
            <h2 className={label}>{t("salesOffice")}</h2>
            <ul className="flex flex-col">
              {contacts.phones.map((phone) => (
                <li key={phone}>
                  <a href={telHref(phone)} data-track="click_call" className={smallLink}>
                    {formatPhone(phone)}
                  </a>
                </li>
              ))}
              {contacts.whatsapp && (
                <li>
                  <a
                    href={whatsappHref(contacts.whatsapp, t("whatsappMessage"))}
                    data-track="click_whatsapp"
                    rel="noopener noreferrer"
                    className={smallLink}
                  >
                    {t("whatsapp")}
                  </a>
                </li>
              )}
              <li>
                <a href={contacts.instagram} rel="noopener noreferrer" className={smallLink}>
                  {t("instagram")}
                </a>
              </li>
            </ul>
            <p className="text-small-t">{t("place")}</p>
          </div>

          <div className="order-last flex flex-col items-center gap-u2 text-center lg:order-2 lg:gap-u3">
            <RoundButton
              as="a"
              href="#main"
              label={t("toTop")}
              icon={
                <ArrowUp width={16} height={16} strokeWidth={1} aria-hidden focusable={false} />
              }
              className="lg:order-first"
            />
            <BrandLink large className="lg:mt-u4" />
            <p className={label}>{t("tagline")}</p>
          </div>

          <nav aria-label={nav("footer")} className="flex flex-col gap-u lg:order-3 lg:items-end">
            <h2 className={label}>{t("pages")}</h2>
            <ul className="grid grid-cols-2 gap-x-u2 lg:flex lg:flex-col lg:items-end">
              {fullNav.map(({ key, href }) => (
                <li key={key}>
                  <Link href={href} data-nav-href={href} className={smallLink}>
                    {nav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-u border-t border-(--t-line) px-layout py-u lg:grid lg:grid-cols-3 lg:items-center">
          <p className="text-small-t">
            {t("rights", { year: String(year) })} · {t("developer", { developer: DEVELOPER })}
          </p>
          <Link
            href={privacyLink.href}
            data-nav-href={privacyLink.href}
            className={`${smallLink} lg:justify-self-center`}
          >
            {nav(privacyLink.key)}
          </Link>
        </div>
      </div>
    </footer>
  );
}
