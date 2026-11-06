import { getLocale } from "next-intl/server";
import { Suspense } from "react";

import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";

import { LocaleSuggestionBanner, type SuggestionCopy } from "./locale-suggestion-banner";

// The suggestion is written in the language it suggests, so the banner gets
// that namespace from every catalogue, not only the current one.
const copy: SuggestionCopy = {
  az: az.LocaleSuggestion,
  en: en.LocaleSuggestion,
  ru: ru.LocaleSuggestion,
};

/** The page's own language is never suggested, so its copy is not sent. */
function omitCurrent(all: SuggestionCopy, current: string): Partial<SuggestionCopy> {
  return Object.fromEntries(Object.entries(all).filter(([locale]) => locale !== current));
}

export async function LocaleSuggestion() {
  const locale = await getLocale();
  // Client-only and optional, so it never holds back the page.
  return (
    <Suspense fallback={null}>
      <LocaleSuggestionBanner copy={omitCurrent(copy, locale)} />
    </Suspense>
  );
}
