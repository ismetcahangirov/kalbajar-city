import { defaultLocale, locales, type Locale } from "./routing";

/** A translatable database field: `az` is required, the others may be empty. */
export type Translatable = { az: string } & Partial<Record<Exclude<Locale, "az">, string | null>>;

export type Localized = {
  value: string;
  /** The locale the value is actually in. */
  locale: Locale;
  /** True when the requested translation was missing and `az` was used. */
  fallback: boolean;
};

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Picks the field's value for the locale, falling back to Azerbaijani when the
 * translation is missing. Render the result with `lang={result.locale}` so a
 * fallback is announced in the right language.
 */
export function localize(field: Translatable, locale: Locale): Localized {
  const value = field[locale];
  if (present(value)) return { value, locale, fallback: false };
  return { value: field.az, locale: defaultLocale, fallback: locale !== defaultLocale };
}

/**
 * Lists the missing translations of an entity's translatable fields, for the
 * console's "missing translations" view.
 */
export function missingTranslations(
  fields: Record<string, Translatable>,
): Array<{ field: string; locale: Locale }> {
  return Object.entries(fields).flatMap(([field, value]) =>
    locales.filter((locale) => !present(value[locale])).map((locale) => ({ field, locale })),
  );
}
