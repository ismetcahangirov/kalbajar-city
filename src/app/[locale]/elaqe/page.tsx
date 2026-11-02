import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LeadForm } from "@/components/leads/lead-form";
import { FadeUp } from "@/components/motion";
import { ContactList } from "@/components/shell/contact-list";
import { Container, Eyebrow, Heading, Text } from "@/components/ui";
import type { LeadType } from "@/shared/leads";

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
 * The viewing and call-back forms with the direct contacts beside them. The
 * rest of the contact page (map, address, office hours) arrives with #20;
 * it adds blocks to the column on the right or below the grid.
 */
export default async function ContactPage() {
  const nav = await getTranslations("Navigation");
  const t = await getTranslations("Contact");
  const form = await getTranslations("LeadForm");
  return (
    <div className="py-section">
      <Container className="flex flex-col gap-block">
        {/* The page head is the only thing here that moves (motion-system.md). */}
        <FadeUp className="flex flex-col gap-4">
          <Heading as="h1" size="display">
            {nav("contact")}
          </Heading>
          <Text size="body-lg" tone="muted" className="max-w-(--container-prose)">
            {t("lead")}
          </Text>
        </FadeUp>

        <div className="grid gap-block lg:grid-cols-12 lg:gap-gutter">
          <div className="flex flex-col gap-gutter lg:col-span-8">
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
            <ContactList />
          </aside>
        </div>
      </Container>
    </div>
  );
}
