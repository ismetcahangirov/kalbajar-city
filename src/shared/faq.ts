import { z } from "zod";

import type { Translatable } from "@/i18n/content";

import { publishStatuses, type PublishStatus } from "./content";

/**
 * The FAQ in the console (#25). Its order is the site's order and the
 * `FAQPage` structured data's, and is changed only through `PUT .../order`.
 * Answers are plain text, because they are also the structured data.
 */

const text = (max: number) =>
  z.object({
    az: z.string().trim().min(1).max(max),
    en: z.string().trim().max(max).nullish(),
    ru: z.string().trim().max(max).nullish(),
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
