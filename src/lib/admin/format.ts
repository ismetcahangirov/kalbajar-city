// The console is Azerbaijani only and formats by the `az` rules of
// `@/i18n/format`: a comma for decimals, a no-break space between thousands.
// It composes the text itself instead of asking `Intl` for "az", because the
// lists render in the browser and not every browser ships Azerbaijani locale
// data (Playwright's Chromium falls back to `62.09` and `2026-11-02 14:14`).

import { bakuOffset } from "./week";

const NBSP = " ";

/** `22 634,5`: up to `digits` decimals, trailing zeros dropped unless `fixed`. */
export function adminNumber(value: number, digits = 2, fixed = false): string {
  const [whole = "0", fraction = ""] = Math.abs(value).toFixed(digits).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = fixed ? fraction : fraction.replace(/0+$/, "");
  return `${value < 0 ? "-" : ""}${grouped}${decimals ? `,${decimals}` : ""}`;
}

/** `62,09 m²` from a `numeric` area string. */
export function adminArea(value: string): string {
  return `${adminNumber(Number(value))}${NBSP}m²`;
}

/**
 * A price from minor units (qəpik) as the API sends it: `125 000 AZN`, with
 * qəpik only when there are any (`99 999,50 AZN`).
 */
export function adminMoney(minor: string, currency: string): string {
  const amount = Number(minor) / 100;
  return `${adminNumber(amount, 2, !Number.isInteger(amount))}${NBSP}${currency}`;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `02.11.2026, 14:05` in Baku time, the business's clock. */
export function adminDateTime(value: string | Date): string {
  const baku = new Date(new Date(value).getTime() + bakuOffset);
  const date = `${pad(baku.getUTCDate())}.${pad(baku.getUTCMonth() + 1)}.${baku.getUTCFullYear()}`;
  return `${date}, ${pad(baku.getUTCHours())}:${pad(baku.getUTCMinutes())}`;
}
