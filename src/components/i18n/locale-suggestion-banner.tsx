"use client";

import { X } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui";
import { locales, type Locale } from "@/i18n/routing";

import { useLocaleHref } from "./use-locale-href";

export type SuggestionCopy = Record<Locale, { message: string; action: string; dismiss: string }>;

const STORAGE_KEY = "kc-locale-suggestion-dismissed";

/** The first supported locale in the browser's preferences, if any. */
function preferredLocale(): Locale | undefined {
  for (const tag of navigator.languages) {
    const base = tag.toLowerCase().split("-")[0];
    const match = locales.find((locale) => locale === base);
    if (match) return match;
  }
  return undefined;
}

/**
 * Offers the visitor's preferred language when the page is in another one.
 * It never redirects, so crawlers and shared links keep the URL's locale.
 * Dismissal is remembered in this browser.
 */
export function LocaleSuggestionBanner({ copy }: { copy: SuggestionCopy }) {
  const current = useLocale();
  const hrefFor = useLocaleHref();
  const [suggested, setSuggested] = useState<Locale>();

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage can be unavailable (private mode); show the suggestion.
    }
    const preferred = preferredLocale();
    if (!dismissed && preferred && preferred !== current) {
      // Reading navigator.languages is only possible after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggested(preferred);
    }
  }, [current]);

  if (!suggested) return null;
  const text = copy[suggested];

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Without storage the banner simply returns on the next page.
    }
    setSuggested(undefined);
  }

  return (
    <aside
      lang={suggested}
      aria-label={text.message}
      data-locale-suggestion=""
      className="fixed inset-x-gutter bottom-(--floating-bottom) z-50 mx-auto flex max-w-(--container-prose) items-center gap-4 rounded-md bg-surface-raised py-2 ps-4 pe-2 text-small text-text shadow-raised"
    >
      <p className="flex-1">
        {text.message}{" "}
        <a
          href={hrefFor(suggested, window.location.search)}
          hrefLang={suggested}
          className="font-medium underline underline-offset-4"
        >
          {text.action}
        </a>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={text.dismiss}
        className="grid size-target shrink-0 place-items-center rounded-full text-text-muted hover:text-text"
      >
        <Icon icon={X} />
      </button>
    </aside>
  );
}
