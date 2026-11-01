import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { LocaleSuggestion } from "@/components/i18n/locale-suggestion";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { MobileActionBar } from "@/components/shell/mobile-action-bar";
import { SkipLink } from "@/components/shell/skip-link";
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

// Edge to edge, so the action bar can sit above the home indicator with
// env(safe-area-inset-bottom).
export const viewport: Viewport = { viewportFit: "cover" };

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${alethia.variable} ${alethiaItalic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SkipLink />
          <Header />
          <main
            id="main"
            tabIndex={-1}
            data-site-main=""
            className="flex flex-1 flex-col outline-none"
          >
            {children}
          </main>
          <Footer />
          <MobileActionBar />
          <LocaleSuggestion />
          <SmoothScroll />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
