import { missingTranslations, type Translatable } from "@/i18n/content";
import { locales, type Locale } from "@/i18n/routing";
import type { RichTextDoc, RichTextNode } from "@/shared/rich-text";

const translationKeys = new Set<string>(locales);

function isRichTextDoc(value: unknown): value is RichTextDoc {
  return typeof value === "object" && value !== null && (value as RichTextDoc).type === "doc";
}

function hasText(nodes: RichTextNode[] | undefined): boolean {
  return (nodes ?? []).some((node) => Boolean(node.text?.trim()) || hasText(node.content));
}

/**
 * The translatable fields inside a stored value: plain (`{ az: "…" }`) and
 * rich text (`{ az: { type: "doc" } }`), however deeply a JSON column nests
 * them. Rich text counts as present when it has any text.
 */
export function translatablesIn(value: unknown): Translatable[] {
  if (Array.isArray(value)) return value.flatMap(translatablesIn);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const isField =
    "az" in record &&
    keys.every((key) => translationKeys.has(key)) &&
    (typeof record.az === "string" || isRichTextDoc(record.az));
  if (!isField) return Object.values(record).flatMap(translatablesIn);

  const text = (entry: unknown) =>
    typeof entry === "string" ? entry : isRichTextDoc(entry) && hasText(entry.content) ? "·" : "";
  return [{ az: text(record.az), en: text(record.en), ru: text(record.ru) }];
}

/** The locales a translatable value lacks; `az` is required by the schema itself. */
export function missingLocales(value: Partial<Translatable> | null | undefined): Locale[] {
  return missingTranslations({ value: { az: "", ...value } }).map(({ locale }) => locale);
}
