import { z } from "zod";

import type { Translatable } from "@/i18n/content";

import { publishStatuses, type PublishStatus } from "./content";

/**
 * The FAQ in the console (#25). Its order is the site's order and the
 * `FAQPage` structured data's, and is changed only through `PUT .../order`.
 * Answers are plain text, because they are also the structured data.
 */

/**
 * The complex's facts a question or answer can quote as `{name}` (#29). The
 * site fills them from the database in the reader's locale
 * (`@/lib/faq-facts`), so the FAQ cannot disagree with the facts block when
 * the console changes a number. Keys of `faq.placeholder.*` in the console's
 * catalogue.
 */
export const faqPlaceholders = [
  "apartments",
  "buildings",
  "blocks",
  "parking",
  "totalArea",
  "layouts",
  "roomsMin",
  "roomsMax",
  "areaMin",
  "areaMax",
  /** The main line the call buttons dial, so an answer never quotes an old number (#29). */
  "phone",
] as const;

export type FaqPlaceholder = (typeof faqPlaceholders)[number];

/** Anything in braces is a placeholder, so a typo (`{Apartments}`, `{area min}`) is caught. */
export const faqPlaceholderPattern = /\{([^{}]*)\}/g;

export function isFaqPlaceholder(name: string): name is FaqPlaceholder {
  return (faqPlaceholders as readonly string[]).includes(name);
}

/** The placeholders in `value` the site cannot fill, as written (`{nope}`), each once. */
export function unknownFaqPlaceholders(value: string): string[] {
  const names = [...value.matchAll(faqPlaceholderPattern)].map((match) => match[1] ?? "");
  return [...new Set(names.filter((name) => !isFaqPlaceholder(name)))].map((name) => `{${name}}`);
}

/**
 * The error for a text with unknown placeholders: the console's catalogue key
 * with the names, which the console's `fieldMessage` translates. The API
 * returns the same string as the field's error.
 */
export function unknownFaqPlaceholderMessage(names: string[]): string {
  return `faq.error.placeholder|${JSON.stringify({ names: names.join(", ") })}`;
}

const placeholderText = <S extends z.ZodType<string>>(schema: S) =>
  schema.superRefine((value, context) => {
    const unknown = unknownFaqPlaceholders(value);
    if (unknown.length) {
      context.addIssue({ code: "custom", message: unknownFaqPlaceholderMessage(unknown) });
    }
  });

const text = (max: number) =>
  z.object({
    az: placeholderText(z.string().trim().min(1).max(max)),
    en: placeholderText(z.string().trim().max(max)).nullish(),
    ru: placeholderText(z.string().trim().max(max)).nullish(),
  }) satisfies z.ZodType<Translatable>;

export const faqQuestionMax = 300;
export const faqAnswerMax = 4000;

export const faqCreateSchema = z.object({
  question: text(faqQuestionMax),
  answer: text(faqAnswerMax),
  /** A draft question stays in the console and is left off the site. */
  status: z.enum(publishStatuses).default("published"),
});

export type FaqCreate = z.input<typeof faqCreateSchema>;

export const faqUpdateSchema = z
  .object({
    question: text(faqQuestionMax),
    answer: text(faqAnswerMax),
    status: z.enum(publishStatuses),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");

export type FaqUpdate = z.input<typeof faqUpdateSchema>;

export const faqIdParamsSchema = z.object({ id: z.uuid() });

export type AdminFaq = {
  id: string;
  question: Translatable;
  answer: Translatable;
  status: PublishStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
