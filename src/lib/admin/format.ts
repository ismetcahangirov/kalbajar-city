import { formatArea, formatNumber } from "@/i18n/format";

// The console is Azerbaijani only, so it formats with the `az` rules of the
// public site's formatters (`@/i18n/format`).

/** `62,09 m²` from a `numeric` area string. */
export function adminArea(value: string): string {
  return formatArea(Number(value), "az");
}

/**
 * A price from minor units (qəpik) as the API sends it: `125 000 AZN`, with
 * qəpik only when there are any (`99 999,50 AZN`).
 */
export function adminMoney(minor: string, currency: string): string {
  const amount = Number(minor) / 100;
  const digits = Number.isInteger(amount) ? 0 : 2;
  const value = formatNumber(amount, "az", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${value} ${currency}`;
}

const dateTime = new Intl.DateTimeFormat("az", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Baku",
});

/** `02.11.2026, 14:05` in Baku time, the business's clock. */
export function adminDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}
