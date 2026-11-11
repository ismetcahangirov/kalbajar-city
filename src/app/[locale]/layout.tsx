import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";

import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { SiteTracking } from "@/components/analytics/site-tracking";
import { LocaleSuggestion } from "@/components/i18n/locale-suggestion";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { FixedButtons } from "@/components/shell/fixed-buttons";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { InquiryDialog } from "@/components/shell/inquiry-dialog";
import { Menu } from "@/components/shell/menu";
import { PageTransition } from "@/components/shell/page-transition";
import { ShellDialogs } from "@/components/shell/shell-dialogs";
import { SkipLink } from "@/components/shell/skip-link";
import { pickMessages, shellMessages } from "@/i18n/client-messages";
import { routing, type Locale } from "@/i18n/routing";
import { getSiteContacts, getSiteVerification } from "@/lib/public/site";
import { siteIndexable, siteNoindexRobots } from "@/lib/seo/indexing";
import { verificationMetadata } from "@/lib/seo/metadata";
import { siteOrigin } from "@/lib/seo/url";

import { alethia, alethiaItalic } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  // The verification tokens come from the console's settings, read per request.
  await connection();
  const [t, verification] = await Promise.all([getTranslations("Metadata"), getSiteVerification()]);
  // Pages set their own title, canonical, alternates and Open Graph through
  // `pageMetadata` (src/lib/seo); these are the defaults under them. The
  // search engines' verification tags (#28, #29) are on every page, so
  // whichever URL the owner gives Search Console or Bing verifies.
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    verification: verificationMetadata(verification),
    ...(!siteIndexable() && { robots: { ...siteNoindexRobots } }),
  };
}

// Edge to edge, so fixed UI can sit above the home indicator with
// env(safe-area-inset-bottom).
export const viewport: Viewport = { viewportFit: "cover" };

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  // The shell shows the contacts from the console's settings (#27), so it is
  // rendered per request; the settings themselves are cached and tagged.
  await connection();
  const locale = (await getLocale()) as Locale;
  const contacts = await getSiteContacts(locale);
  const messages = pickMessages(await getMessages(), shellMessages);
  return (
    <html
      lang={locale}
      className={`${alethia.variable} ${alethiaItalic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={messages} formats={null}>
          <SkipLink />
          <Header contacts={contacts} />
          <main
            id="main"
            tabIndex={-1}
            data-site-main=""
            className="flex flex-1 flex-col outline-none"
          >
            {children}
          </main>
          <Footer contacts={contacts} />
          <FixedButtons contacts={contacts} />
          {/* Server-rendered dialogs and curtain; ShellDialogs and
              PageTransition drive them. */}
          <Menu contacts={contacts} />
          <InquiryDialog />
          <PageTransition />
          <ShellDialogs />
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
