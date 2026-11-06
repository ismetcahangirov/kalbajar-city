"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { locales, type Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";

import { useLocaleHref } from "./use-locale-href";

/**
 * `AZ · EN · RU`. Each link leads to the same page, with the same slug and
 * query, in that locale. The links are plain anchors: switching language is
 * a full document load, so `<html lang>`, fonts and metadata start clean.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  return (
    <Suspense fallback={<Links className={className} search="" />}>
      <LinksWithQuery className={className} />
    </Suspense>
  );
}

// useSearchParams needs a Suspense boundary under Cache Components; the
// fallback is the same links without the query string.
function LinksWithQuery({ className }: { className?: string }) {
  const search = useSearchParams().toString();
  return <Links className={className} search={search} />;
}

function Links({ className, search }: { className?: string; search: string }) {
  const t = useTranslations("LocaleSwitcher");
  const current = useLocale();
  const hrefFor = useLocaleHref();

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex items-center">
        {locales.map((locale: Locale) => (
          <li key={locale}>
            <a
              href={hrefFor(locale, search)}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={cx(
                "inline-flex min-h-target min-w-target items-center justify-center text-label uppercase",
                // The current language is underlined, not only coloured.
                locale === current
                  ? "text-(--t-text) underline decoration-1 underline-offset-4"
                  : "text-(--t-small) hover:underline hover:decoration-1 hover:underline-offset-4",
              )}
            >
              {locale}
              {/* The visible code starts the accessible name (WCAG 2.5.3, label in name).
                  Never painted, so "Русский" must not make an az page fetch the Cyrillic file. */}
              <span className="sr-only font-system"> {t(locale)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
