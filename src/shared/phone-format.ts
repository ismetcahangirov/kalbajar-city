// Apart from `@/shared/phone` because a form's first load has no use for zod
// (CLAUDE.md §5). `@/shared/phone` re-exports `normalizePhone`.

/** A phone number in E.164, as it is stored and sent over the API. */
export const e164Pattern = /^\+[1-9]\d{6,14}$/;

/** Azerbaijan's country code; national numbers have nine digits after it. */
const azCode = "994";
const azDigits = 9;

/**
 * A phone number as a visitor types it, in E.164, or `null` when it is not
 * one. Azerbaijani numbers are accepted in every local notation
 * (`050 123 45 67`, `0501234567`, `50 123 45 67`, `(012) 123 45 67`) and
 * internationally (`+994…`, `00994…`, even with the trunk 0 kept:
 * `+994 050…`); any other country needs its `+` or `00` code.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  // Spaces, dashes, dots and brackets are notation, not digits.
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");

  let international: string;
  if (trimmed.startsWith("+")) international = digits;
  else if (digits.startsWith("00")) international = digits.slice(2);
  else if (digits.length === azDigits + 1 && digits.startsWith("0")) {
    international = azCode + digits.slice(1);
  } else if (digits.length === azDigits) international = azCode + digits;
  else if (digits.length === azCode.length + azDigits && digits.startsWith(azCode)) {
    international = digits;
  } else return null;

  if (international.startsWith(azCode)) {
    let national = international.slice(azCode.length);
    if (national.length === azDigits + 1 && national.startsWith("0")) national = national.slice(1);
    return national.length === azDigits && !national.startsWith("0")
      ? `+${azCode}${national}`
      : null;
  }
  const e164 = `+${international}`;
  return e164Pattern.test(e164) ? e164 : null;
}
