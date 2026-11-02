import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { NavKey } from "@/components/shell/navigation";
import { Container, Heading, Text } from "@/components/ui";
import type { Locale } from "@/i18n/routing";
import type { PageHref } from "@/lib/seo/metadata";
import { pageMetadata } from "@/lib/seo/page-metadata";

/** Centres the content of a page that its own issue has not built yet. */
export function PlaceholderFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col justify-center py-section">
      <Container className="flex flex-col items-center gap-6 text-center">{children}</Container>
    </div>
  );
}

/** A navigation target whose page issue has not landed: title and a note. */
export function PlaceholderPage({ page }: { page: NavKey }) {
  const nav = useTranslations("Navigation");
  const t = useTranslations("Placeholder");
  return (
    <PlaceholderFrame>
      <Heading as="h1" size="display" align="center">
        {nav(page)}
      </Heading>
      <Text tone="muted">{t("body")}</Text>
    </PlaceholderFrame>
  );
}

/**
 * A placeholder has nothing to index yet: `noindex, follow`, left out of the
 * sitemaps, until its issue builds the page.
 */
export async function placeholderMetadata(page: NavKey, href: PageHref): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const nav = await getTranslations("Navigation");
  return pageMetadata({ locale, href, title: nav(page), indexable: false });
}
