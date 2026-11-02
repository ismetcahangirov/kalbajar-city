import { z } from "zod";

import type { Translatable } from "@/i18n/content";

import { listOf, paginationSchema } from "./api";
import { translatableRichTextSchema, type TranslatableRichText } from "./rich-text";
import { translatableSchema } from "./translatable";

/**
 * Construction updates and news (#21): what the console sends and receives.
 * The content module's screens arrive with #25; these endpoints are what it
 * builds on. Publishing is its own endpoint, because it needs
 * `content:publish`, which an editor's `content:update` does not imply.
 */

export const publishStatuses = ["draft", "published"] as const;

export type PublishStatus = (typeof publishStatuses)[number];

/** Azerbaijani, lower case, hyphenated (`CLAUDE.md` §3); made from the title when left out. */
export const contentSlugSchema = z
  .string()
  .trim()
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, digits and hyphens");

/**
 * The month an update reports on, `2026-09` or `2026-09-01`; stored as the
 * first day of the month.
 */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/, "Give the month as YYYY-MM")
  .transform((value) => `${value.slice(0, 7)}-01`);

const mediaIdList = z
  .array(z.uuid())
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "A file may appear only once");

const notEmpty = (value: object) => Object.keys(value).length > 0;

export const constructionUpdateCreateSchema = z.object({
  slug: contentSlugSchema.optional(),
  month: monthSchema,
  title: translatableSchema,
  body: translatableRichTextSchema.nullish(),
  progressPercent: z.int().min(0).max(100),
  /** Photos and video in display order. */
  mediaIds: mediaIdList.default([]),
});

export type ConstructionUpdateCreate = z.input<typeof constructionUpdateCreateSchema>;

export const constructionUpdateUpdateSchema = z
  .object({
    slug: contentSlugSchema,
    month: monthSchema,
    title: translatableSchema,
    body: translatableRichTextSchema.nullable(),
    progressPercent: z.int().min(0).max(100),
  })
  .partial()
  .refine(notEmpty, "Change at least one field");

export type ConstructionUpdateUpdate = z.input<typeof constructionUpdateUpdateSchema>;

/** `PUT .../media`: the update's whole media list, in order. Attaches, detaches and reorders. */
export const contentMediaSchema = z.object({ mediaIds: mediaIdList });

export type ContentMedia = z.input<typeof contentMediaSchema>;

/**
 * `PUT .../publication`. Without `publishedAt` the entry keeps the date it
 * was first published, or gets the current time. A date in the future is
 * refused: public pages are cached until the next write, so a scheduled
 * entry would not appear on its own.
 */
export const publicationSchema = z.object({
  publishedAt: z.iso.datetime({ offset: true }).optional(),
});

export type Publication = z.input<typeof publicationSchema>;

export const newsCreateSchema = z.object({
  slug: contentSlugSchema.optional(),
  title: translatableSchema,
  excerpt: translatableSchema.nullish(),
  body: translatableRichTextSchema,
  coverMediaId: z.uuid().nullish(),
});

export type NewsCreate = z.input<typeof newsCreateSchema>;

export const newsUpdateSchema = z
  .object({
    slug: contentSlugSchema,
    title: translatableSchema,
    excerpt: translatableSchema.nullable(),
    body: translatableRichTextSchema,
    coverMediaId: z.uuid().nullable(),
  })
  .partial()
  .refine(notEmpty, "Change at least one field");

export type NewsUpdate = z.input<typeof newsUpdateSchema>;

/** `GET` of either list, newest first. */
export const contentListQuerySchema = paginationSchema.extend({
  status: listOf(z.enum(publishStatuses)),
});

export type ContentListParams = { page?: number; pageSize?: number; status?: PublishStatus[] };

export const contentIdParamsSchema = z.object({ id: z.uuid() });

export type AdminConstructionUpdate = {
  id: string;
  slug: string;
  /** The first day of the month, `2026-09-01`. */
  month: string;
  title: Translatable;
  body: TranslatableRichText | null;
  progressPercent: number;
  status: PublishStatus;
  publishedAt: string | null;
  mediaIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminNews = {
  id: string;
  slug: string;
  title: Translatable;
  excerpt: Translatable | null;
  body: TranslatableRichText;
  coverMediaId: string | null;
  status: PublishStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
