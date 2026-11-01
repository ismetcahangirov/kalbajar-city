import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { NavKey } from "@/components/shell/navigation";
import { Container, Heading, Text } from "@/components/ui";

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

export async function placeholderMetadata(page: NavKey): Promise<Metadata> {
  const nav = await getTranslations("Navigation");
  return { title: nav(page) };
}
