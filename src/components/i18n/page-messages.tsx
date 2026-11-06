import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { pickMessages, type PageNamespace } from "@/i18n/client-messages";

/**
 * Sends the catalogue namespaces a page's client islands read, around those
 * islands, so other pages' HTML does not carry them. It replaces the shell's
 * messages inside it: wrap the island, not the page.
 */
export async function PageMessages({
  namespaces,
  children,
}: {
  namespaces: readonly PageNamespace[];
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider messages={pickMessages(await getMessages(), namespaces)}>
      {children}
    </NextIntlClientProvider>
  );
}
