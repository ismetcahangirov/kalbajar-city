import { localize, type Localized, type Translatable } from "@/i18n/content";
import { formatArea, formatNumber } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { faqPlaceholderPattern, type FaqPlaceholder } from "@/shared/faq";

import { layoutFacts, type ComplexFacts } from "./facts";

/** What the FAQ's placeholders are filled from: the complex's settings and the layout types. */
export type FaqFacts = {
  complex: ComplexFacts | null;
  layouts: Array<{ rooms: number; areaTotal: string }>;
};

/**
 * Each placeholder's text in one locale, formatted with `@/i18n/format`
 * (`22 634 m²` in Azerbaijani). A fact that is not known yet (a count of
 * zero, no layouts) has no value, so nothing wrong or empty is printed.
 */
export function faqFactValues(
  { complex, layouts }: FaqFacts,
  locale: Locale,
): Partial<Record<FaqPlaceholder, string>> {
  const values: Partial<Record<FaqPlaceholder, string>> = {};
  const count = (key: FaqPlaceholder, value: number | undefined) => {
    if (value && value > 0) values[key] = formatNumber(value, locale);
  };
  const area = (key: FaqPlaceholder, value: number | undefined) => {
    if (value && value > 0) values[key] = formatArea(value, locale);
  };
  count("apartments", complex?.apartments);
  count("buildings", complex?.buildings);
  count("blocks", complex?.blocks);
  count("parking", complex?.parkingSpaces);
  area("totalArea", complex ? Number(complex.totalArea) : undefined);
  const summary = layoutFacts(layouts);
  if (summary) {
    count("layouts", layouts.length);
    count("roomsMin", summary.rooms[0]);
    count("roomsMax", summary.rooms.at(-1));
    area("areaMin", summary.areaMin);
    area("areaMax", summary.areaMax);
  }
  return values;
}

/**
 * The text with its placeholders filled in the locale it is actually in
 * (an English page falling back to the Azerbaijani answer gets Azerbaijani
 * numbers); null when one of them has no value, or is not a placeholder at all.
 */
function fill(field: Translatable, locale: Locale, facts: FaqFacts): Localized | null {
  const text = localize(field, locale);
  let values: Partial<Record<FaqPlaceholder, string>> | undefined;
  let complete = true;
  const value = text.value.replace(faqPlaceholderPattern, (match, name: string) => {
    values ??= faqFactValues(facts, text.locale);
    const filled = values[name as FaqPlaceholder];
    if (filled === undefined) complete = false;
    return filled ?? match;
  });
  return complete ? { ...text, value } : null;
}

/**
 * The published FAQ as every reader outputs it: the home page's FAQ, its
 * `FAQPage` structured data and `llms.txt`. Placeholders (`{apartments}`) are
 * filled from the facts; a question whose text quotes a fact that is not known
 * yet is left out rather than shown with a wrong or empty value (#29).
 */
export function publicFaqItems(
  rows: Array<{ question: Translatable; answer: Translatable }>,
  locale: Locale,
  facts: FaqFacts,
): Array<{ question: Localized; answer: Localized }> {
  return rows.flatMap((row) => {
    const question = fill(row.question, locale, facts);
    const answer = fill(row.answer, locale, facts);
    return question && answer ? [{ question, answer }] : [];
  });
}
