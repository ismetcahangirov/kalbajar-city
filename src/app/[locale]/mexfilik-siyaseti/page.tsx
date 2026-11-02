import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { PageHead } from "@/components/site/page-head";
import { Container, Heading, Text } from "@/components/ui";
import { privacy } from "@/config/privacy";
import { formatPhone } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAboutPage, getLeadRetentionMonths, getSiteContacts } from "@/lib/public/site";

// Names the developer and the contacts from the console's settings, so it
// renders per request and is sent complete (CLAUDE.md → Data and state).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Privacy");
  return { title: nav("privacy"), description: t("description") };
}

/**
 * The privacy notice for the lead forms: what they collect and why, where it
 * is kept, who receives it, for how long (the console's leads settings, which
 * the retention job applies; `src/config/privacy.ts` until they are saved), analytics, browser storage and the visitor's
 * rights. The text lives in the catalogues, in every locale.
 */
export default async function PrivacyPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const [contacts, about, retentionMonths] = await Promise.all([
    getSiteContacts(locale),
    getAboutPage(locale),
    getLeadRetentionMonths(),
  ]);
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Privacy");
  const format = await getFormatter();
  const updated = new Date(`${privacy.updated}T00:00:00Z`);
  const phone = contacts.phones[0];

  return (
    <>
      <PageHead
        title={nav("privacy")}
        lead={t("lead")}
        meta={
          <time dateTime={privacy.updated}>
            {t("updated", { date: format.dateTime(updated, "long") })}
          </time>
        }
      />
      <div className="pb-section">
        {/* The prose measure, aligned with the page head rather than centred. */}
        <Container className="flex flex-col gap-block *:max-w-(--container-prose)">
          <Block title={t("controller.title")}>
            <Text>{t("controller.body", { developer: about.developer.name })}</Text>
          </Block>
          <Block title={t("data.title")}>
            <Text>{t("data.body")}</Text>
            <List
              items={[
                t("data.items.contact"),
                t("data.items.request"),
                t("data.items.attribution"),
                t("data.items.language"),
              ]}
            />
            <Text>{t("data.none")}</Text>
          </Block>
          <Block title={t("purpose.title")}>
            <Text>{t("purpose.body")}</Text>
          </Block>
          <Block title={t("storage.title")}>
            <Text>{t("storage.body")}</Text>
          </Block>
          <Block title={t("recipients.title")}>
            <Text>{t("recipients.body")}</Text>
          </Block>
          <Block title={t("retention.title")}>
            <Text>{t("retention.body", { months: retentionMonths })}</Text>
          </Block>
          <Block title={t("analytics.title")}>
            <Text>{t("analytics.body")}</Text>
          </Block>
          <Block title={t("cookies.title")}>
            <Text>{t("cookies.body")}</Text>
            <List items={[t("cookies.items.locale"), t("cookies.items.attribution")]} />
            <Text>{t("cookies.console")}</Text>
          </Block>
          <Block title={t("rights.title")}>
            <Text>{t("rights.body")}</Text>
            <List
              items={[
                t("rights.items.access"),
                t("rights.items.correct"),
                t("rights.items.delete"),
                t("rights.items.object"),
                t("rights.items.withdraw"),
              ]}
            />
          </Block>
          <Block title={t("contact.title")}>
            <Text>
              {t.rich("contact.body", {
                phone: phone ? formatPhone(phone) : "",
                link: (chunks) => (
                  <Link href="/elaqe" className="underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </Text>
            {contacts.email && <Text>{t("contact.email", { email: contacts.email })}</Text>}
          </Block>
        </Container>
      </div>
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <Heading as="h2" size="heading">
        {title}
      </Heading>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 ps-6 text-body marker:text-text-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
