import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { LeadForm } from "@/components/leads/lead-form";
import { ContactDetails } from "@/components/site/contact-details";
import { MapBlock } from "@/components/site/map-block";
import { PageHead } from "@/components/site/page-head";
import { Container, Eyebrow, Heading, Text } from "@/components/ui";
import type { Locale } from "@/i18n/routing";
import { getLocationPage, getSiteContacts } from "@/lib/public/site";
import type { LeadType } from "@/shared/leads";

// Contacts come from the console's settings: rendered per request and sent
// complete (CLAUDE.md → Data and state); the data itself is cached and tagged.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Contact");
  return { title: nav("contact"), description: t("description") };
}

/** Anchors, so other pages can link straight to a form (`/elaqe#baxis`). */
const forms: Array<{ type: LeadType; id: string }> = [
  { type: "viewing", id: "baxis" },
  { type: "callback", id: "geri-zeng" },
];

/**
 * The viewing and call-back forms with every direct contact beside them, and
 * the map below once the owner has confirmed the coordinates (#7).
 */
export default async function ContactPage() {
  await connection();
  const locale = (await getLocale()) as Locale;
  const [contacts, location] = await Promise.all([
    getSiteContacts(locale),
    getLocationPage(locale),
  ]);
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Contact");
  const form = await getTranslations("LeadForm");
  return (
    <>
      <PageHead title={nav("contact")} lead={t("lead")} />
      <div className="pb-section">
        <Container className="flex flex-col gap-section">
          <div className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
            <div className="flex flex-col gap-gutter lg:col-span-8">
              {/* Forms never animate (motion-system.md), so nothing here is wrapped in an entry. */}
              {forms.map(({ type, id }) => (
                <section
                  key={type}
                  id={id}
                  aria-labelledby={`${id}-basliq`}
                  className="flex flex-col gap-6 rounded-md bg-surface-raised p-6 lg:p-10"
                >
                  <div className="flex flex-col gap-2">
                    <Heading as="h2" size="heading" id={`${id}-basliq`}>
                      {form(`heading.${type}`)}
                    </Heading>
                    <Text tone="muted">{form(`intro.${type}`)}</Text>
                  </div>
                  <LeadForm type={type} labelledBy={`${id}-basliq`} />
                </section>
              ))}
            </div>
            <aside aria-labelledby="birbasa-elaqe" className="flex flex-col gap-4 lg:col-span-4">
              <Eyebrow as="h2" id="birbasa-elaqe">
                {t("direct")}
              </Eyebrow>
              <ContactDetails contacts={contacts} />
            </aside>
          </div>
          {contacts.coordinates && (
            <section aria-labelledby="xerite" className="flex flex-col gap-block">
              <Heading as="h2" size="heading" id="xerite">
                {t("map")}
              </Heading>
              <MapBlock coordinates={contacts.coordinates} image={location.map} />
            </section>
          )}
        </Container>
      </div>
    </>
  );
}
