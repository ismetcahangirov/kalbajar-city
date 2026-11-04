import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { ArticleHead } from "@/components/pages/article-head";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { privacy } from "@/config/privacy";
import { formatPhone } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  getAboutPage,
  getAnalyticsIds,
  getLeadRetentionMonths,
  getSiteContacts,
} from "@/lib/public/site";
import { pageMetadata } from "@/lib/seo/page-metadata";

// Names the developer and the contacts from the console's settings, so it
// renders per request and is sent complete (CLAUDE.md → Data and state).
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Privacy");
  return pageMetadata({
    locale,
    href: "/mexfilik-siyaseti",
    title: nav("privacy"),
    description: t("description"),
  });
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
  const [contacts, about, retentionMonths, analytics] = await Promise.all([
    getSiteContacts(locale),
    getAboutPage(locale),
    getLeadRetentionMonths(),
    getAnalyticsIds(),
  ]);
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Privacy");
  const format = await getFormatter();
  // The services the layout loads (`AnalyticsScripts`), named as the notice promises.
  const services = [
    analytics.googleAnalyticsId && "Google Analytics 4 (Google)",
    analytics.metaPixelId && "Meta Pixel (Meta Platforms)",
  ].filter((service): service is string => !!service);
  const servicesText = format.list(services, { type: "conjunction" });
  const updated = new Date(`${privacy.updated}T00:00:00Z`);
  const phone = contacts.phones[0];

  return (
    <>
      {/* The article layout (reference `/news` article): title, date, rule, a 720 px column. */}
      <div
        data-theme="light"
        className="flex flex-col bg-(--t-bg) pb-u6 text-(--t-text) desk:pb-u9"
      >
        <ArticleHead
          title={nav("privacy")}
          meta={
            <time dateTime={privacy.updated}>
              {t("updated", { date: format.dateTime(updated, "long") })}
            </time>
          }
        />
        <div className="mx-auto flex w-full max-w-[45rem] flex-col gap-u4 px-layout pt-u4 desk:px-0">
          <p className="text-lead">{t("lead")}</p>
          <Block title={t("controller.title")}>
            <p>{t("controller.body", { developer: about.developer.name })}</p>
          </Block>
          <Block title={t("data.title")}>
            <p>{t("data.body")}</p>
            <List
              items={[
                t("data.items.contact"),
                t("data.items.request"),
                t("data.items.attribution"),
                t("data.items.language"),
              ]}
            />
            <p>{t("data.none")}</p>
          </Block>
          <Block title={t("purpose.title")}>
            <p>{t("purpose.body")}</p>
          </Block>
          <Block title={t("storage.title")}>
            <p>{t("storage.body")}</p>
          </Block>
          <Block title={t("recipients.title")}>
            <p>{t("recipients.body")}</p>
          </Block>
          <Block title={t("retention.title")}>
            <p>{t("retention.body", { months: retentionMonths })}</p>
          </Block>
          <Block title={t("analytics.title")}>
            <p>
              {services.length
                ? t("analytics.bodyActive", { services: servicesText })
                : t("analytics.body")}
            </p>
          </Block>
          <Block title={t("cookies.title")}>
            <p>{services.length ? t("cookies.bodyActive") : t("cookies.body")}</p>
            <List items={[t("cookies.items.locale"), t("cookies.items.attribution")]} />
            <p>{t("cookies.console")}</p>
          </Block>
          <Block title={t("rights.title")}>
            <p>{t("rights.body")}</p>
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
            <p>
              {t.rich("contact.body", {
                phone: phone ? formatPhone(phone) : "",
                link: (chunks) => (
                  <Link href="/elaqe" className="underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            {contacts.email && <p>{t("contact.email", { email: contacts.email })}</p>}
          </Block>
        </div>
      </div>
      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: nav("privacy"), href: "/mexfilik-siyaseti" }])]}
      />
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-u text-body [&_a]:underline-offset-4">
      <h2 className="text-lead">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-u ps-u2 text-body marker:text-(--t-small)">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
