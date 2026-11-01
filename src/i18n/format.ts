import type { Formats } from "next-intl";

import type { Locale } from "./routing";

/** Date presets for `format.dateTime(date, "long")` and friends. */
export const formats = {
  dateTime: {
    long: { day: "numeric", month: "long", year: "numeric" },
    monthYear: { month: "long", year: "numeric" },
    short: { day: "2-digit", month: "2-digit", year: "numeric" },
  },
} satisfies Formats;

const NBSP = " ";

// Building an Intl.NumberFormat costs far more than using one, and CountUp
// formats on every frame.
const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, format);
  }
  return format;
}

/**
 * Formats a number for the locale. Azerbaijani groups thousands with a
 * no-break space (`22 634`), as the owner's material does, not with the dot
 * CLDR gives (`22.634`); the decimal mark stays a comma. Russian already uses
 * a no-break space; English keeps its comma.
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  const parts = numberFormat(locale, options).formatToParts(value);
  return parts
    .map((part) => (part.type === "group" && locale !== "en" ? NBSP : part.value))
    .join("");
}

// Typographic unit symbols (like a currency code), not translatable copy.
const squareMetre: Record<Locale, string> = { az: "m²", en: "m²", ru: "м²" };

/** An area in square metres with up to two decimals: `62,09 m²`. */
export function formatArea(value: number, locale: Locale): string {
  return `${formatNumber(value, locale, { maximumFractionDigits: 2 })}${NBSP}${squareMetre[locale]}`;
}

/**
 * A phone number for display. Azerbaijani numbers in E.164 (`+994501234567`)
 * become `+994 50 123 45 67`; anything else is returned as given.
 */
export function formatPhone(e164: string): string {
  const match = e164.replace(/[\s()-]/g, "").match(/^\+994(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (!match) return e164;
  const [, operator, a, b, c] = match;
  return `+994${NBSP}${operator}${NBSP}${a}${NBSP}${b}${NBSP}${c}`;
}

/** The `tel:` href for a phone number in any common notation. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
