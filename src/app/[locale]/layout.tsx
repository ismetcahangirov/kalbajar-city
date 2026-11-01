import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { LocaleSuggestion } from "@/components/i18n/locale-suggestion";
import { routing } from "@/i18n/routing";

import { alethia, alethiaItalic } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${alethia.variable} ${alethiaItalic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <LocaleSuggestion />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
