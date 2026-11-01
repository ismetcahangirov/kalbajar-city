import type { Localized as LocalizedValue } from "@/i18n/content";

/**
 * Console text in the page's language, or in Azerbaijani when the translation
 * is missing; then it carries `lang="az"`, so it is read and hyphenated right.
 */
export function Localized({ text }: { text: LocalizedValue }) {
  return text.fallback ? <span lang={text.locale}>{text.value}</span> : text.value;
}
