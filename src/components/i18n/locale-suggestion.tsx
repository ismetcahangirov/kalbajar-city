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

export function LocaleSuggestion() {
  // Client-only and optional, so it never holds back the page.
  return (
    <Suspense fallback={null}>
      <LocaleSuggestionBanner copy={copy} />
    </Suspense>
  );
}
