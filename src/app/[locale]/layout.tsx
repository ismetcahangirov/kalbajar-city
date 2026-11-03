import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { SiteTracking } from "@/components/analytics/site-tracking";
import { LocaleSuggestion } from "@/components/i18n/locale-suggestion";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { MobileActionBar } from "@/components/shell/mobile-action-bar";
import { SkipLink } from "@/components/shell/skip-link";
import { routing } from "@/i18n/routing";
import { siteOrigin } from "@/lib/seo/url";

import { alethia, alethiaItalic } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  // Pages set their own title, canonical, alternates and Open Graph through
  // `pageMetadata` (src/lib/seo); these are the defaults under them.
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
  };
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
          <SiteTracking />
          {/* Reads the settings per request; not page content, so it may arrive last. */}
          <Suspense fallback={null}>
            <AnalyticsScripts />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
