import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { LeadForm } from "@/components/leads/lead-form";
import { PageHero } from "@/components/pages/page-hero";
import { breadcrumbs, StructuredData } from "@/components/seo/structured-data";
import { ContactDetails } from "@/components/site/contact-details";
import { MapBlock } from "@/components/site/map-block";
import { defaultImage } from "@/content/defaults";
import type { Locale } from "@/i18n/routing";
import { getLocationPage, getSiteContacts } from "@/lib/public/site";
import { pageMetadata } from "@/lib/seo/page-metadata";
import type { LeadType } from "@/shared/leads";

// Contacts come from the console's settings: rendered per request and sent
// complete (CLAUDE.md → Data and state); the data itself is cached and tagged.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Contact");
  return pageMetadata({
    locale,
    href: "/elaqe",
    title: nav("contact"),
    description: t("description"),
  });
}

/** Anchors, so other pages can link straight to a form (`/elaqe#baxis`). */
const forms: Array<{ type: LeadType; id: string }> = [
  { type: "viewing", id: "baxis" },
  { type: "callback", id: "geri-zeng" },
];

/**
 * `/elaqe` after the reference's `/contacts`: the split title with the
 * centred image, the three contact columns, the map once the owner has
 * confirmed the coordinates (#7), and the viewing and call-back forms
 * inline on sand. Forms never animate: every state changes at once. The
 * last chapter, so it has no next-chapter teaser.
 */
export default async function ContactPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const [contacts, location] = await Promise.all([
    getSiteContacts(locale),
    getLocationPage(locale),
  ]);
  const nav = await getTranslations("Navigation");
  const words = await getTranslations("Pages.words");
  const t = await getTranslations("Contact");
  const form = await getTranslations("LeadForm");
  return (
    <>
      <PageHero
        title={nav("contact")}
        word={words("contact")}
        subtitle={t("lead")}
        next="birbasa"
        theme="light"
        layout="framed"
        image={defaultImage("page.elaqe", locale)}
      />

      <section
        id="birbasa"
        data-theme="light"
        aria-labelledby="birbasa-elaqe"
        className="border-y border-(--t-line) bg-(--t-bg) px-layout py-u4 text-(--t-text)"
      >
        <h2 id="birbasa-elaqe" className="sr-only">
          {t("direct")}
        </h2>
        <ContactDetails contacts={contacts} />
      </section>

      {contacts.coordinates && (
        <section
          data-theme="light"
          aria-labelledby="xerite"
          className="flex flex-col gap-u2 bg-(--t-bg) px-layout py-u4 text-(--t-text)"
        >
          <h2 id="xerite" className="text-label text-(--t-small) uppercase">
            {t("map")}
          </h2>
          <MapBlock coordinates={contacts.coordinates} image={location.map} />
        </section>
      )}

      {/* Forms never animate (motion-system.md), so nothing here is wrapped in an entry. */}
      <div
        data-theme="sand"
        className="grid gap-u6 bg-(--t-bg) px-layout py-u6 text-(--t-text) [--t-small:var(--t-text)] desk:py-u9 lg:grid-cols-2 lg:gap-u2"
      >
        {forms.map(({ type, id }) => (
          <section
            key={type}
            id={id}
            aria-labelledby={`${id}-basliq`}
            className="flex flex-col gap-u3 lg:px-u"
          >
            <div className="flex flex-col gap-u">
              <h2 id={`${id}-basliq`} className="text-title uppercase">
                {form(`heading.${type}`)}
              </h2>
              <p className="max-w-(--container-prose) text-body">{form(`intro.${type}`)}</p>
            </div>
            <LeadForm type={type} labelledBy={`${id}-basliq`} appearance="hairline" />
          </section>
        ))}
      </div>

      <StructuredData
        locale={locale}
        nodes={[await breadcrumbs(locale, [{ name: nav("contact"), href: "/elaqe" }])]}
      />
    </>
  );
}
