import { cacheLife } from "next/cache";
import { useTranslations } from "next-intl";

import { Container, Eyebrow, Text } from "@/components/ui";
import { Link } from "@/i18n/navigation";

import { ContactList } from "./contact-list";
import { underlineLinkClass } from "./link-class";
import { footerNav, privacyLink, type NavItem } from "./navigation";
import { Wordmark } from "./wordmark";

// A company name, the same in every language.
const DEVELOPER = "InCity Projects";

// The year for the copyright line, refreshed daily rather than per request.
async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

/** On `night`: contacts, navigation, socials and legal, closing on the wordmark. */
export async function Footer() {
  return <FooterContent year={await currentYear()} />;
}

function FooterContent({ year }: { year: number }) {
  const t = useTranslations("Shell");
  const nav = useTranslations("Navigation");

  return (
    <footer data-tone="night" className="pt-section pb-(--action-bar-space)">
      <Container className="grid gap-block md:grid-cols-8 lg:grid-cols-12">
        <div className="flex flex-col gap-2 md:col-span-8 lg:col-span-4">
          <Text size="body-lg">{t("brand")}</Text>
          <Text tone="muted">{t("place")}</Text>
        </div>
        <nav
          aria-label={nav("footer")}
          className="grid grid-cols-2 gap-gutter md:col-span-5 lg:col-span-5"
        >
          <LinkColumn title={t("columnComplex")} items={footerNav.complex} />
          <LinkColumn title={t("columnUpdates")} items={footerNav.updates} />
        </nav>
        <div className="flex flex-col gap-4 md:col-span-3 lg:col-span-3">
          <Eyebrow as="h2">{t("contacts")}</Eyebrow>
          <ContactList />
        </div>
      </Container>

      <Container className="mt-block">
        <div className="flex flex-col gap-2 border-t border-border pt-6 text-small text-text-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8">
          <p>
            {t("rights", { year: String(year) })} · {t("developer", { developer: DEVELOPER })}
          </p>
          <Link href={privacyLink.href} className={underlineLinkClass()}>
            {nav(privacyLink.key)}
          </Link>
        </div>
        <Wordmark className="mt-block" />
      </Container>
    </footer>
  );
}

function LinkColumn({ title, items }: { title: string; items: NavItem[] }) {
  const nav = useTranslations("Navigation");
  return (
    <div className="flex flex-col gap-4">
      <Eyebrow as="h2">{title}</Eyebrow>
      <ul className="flex flex-col">
        {items.map(({ key, href }) => (
          <li key={key}>
            <Link href={href} className={underlineLinkClass()}>
              {nav(key)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
