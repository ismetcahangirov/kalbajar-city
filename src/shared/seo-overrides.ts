import { z } from "zod";

import { locales, type Locale } from "@/i18n/routing";

/*
 * Per-page SEO overrides managed in the console (#27), stored in
 * `seo_overrides` and read by `getSeoOverride()` (`@/lib/public/seo`). An
 * override applies only in the locales it has a value for, so every language
 * may be left blank, Azerbaijani included. Refinement messages are console
 * catalogue keys (`@/lib/admin/messages`).
 */

/**
 * Lengths past which search engines usually cut the text in a result. They
 * are warnings in the console, not rules: a longer text is still saved.
 */
export const seoLengths = { title: 60, description: 160 } as const;

/** Hard limits, far above the warnings, against pasted junk. */
const maxLengths = { title: 200, description: 500 } as const;

/** The first segments a key may not start with: locale prefixes and paths that are no pages. */
const reservedSegments = new Set<string>([
  ...locales.filter((locale) => locale !== "az"),
  "admin",
  "api",
  "_next",
  "_vercel",
]);

/**
 * A page's key as `overrideKey()` in `@/lib/seo/metadata` makes it: the
 * Azerbaijani path without a locale prefix, decoded and without a trailing
 * slash, with the query of a query view (`/menziller?otaq=2`) kept as typed.
 */
export function normalizeOverridePath(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.indexOf("?");
  let path = at === -1 ? trimmed : trimmed.slice(0, at);
  const query = at === -1 ? "" : trimmed.slice(at);
  try {
    path = decodeURI(path);
  } catch {
    // A malformed escape stays as typed; it simply names no page.
  }
  path = path.length > 1 ? path.replace(/\/+$/, "") || "/" : path;
  return `${path}${query === "?" ? "" : query}`;
}

function firstSegment(path: string): string {
  return path.split(/[/?]/)[1] ?? "";
}

export const seoPathSchema = z
  .string()
  .trim()
  .min(1, "seo.error.slash")
  .max(500)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), "seo.error.slash")
  .refine((value) => !/[\s#\\]/.test(value), "seo.error.characters")
  .transform(normalizeOverridePath)
  .refine((value) => !reservedSegments.has(firstSegment(value)), "seo.error.reserved");

const text = (max: number) => z.string().trim().max(max, "seo.error.tooLong").default("");

function textsSchema(max: number) {
  return z.object({ az: text(max), en: text(max), ru: text(max) });
}

export const seoTitleSchema = textsSchema(maxLengths.title);
export const seoDescriptionSchema = textsSchema(maxLengths.description);

/** One text in every language, a blank meaning "no override in this language". */
export type SeoTexts = Record<Locale, string>;

const blank = (texts: SeoTexts) => locales.every((locale) => !texts[locale]);

export const seoOverrideCreateSchema = z
  .object({
    path: seoPathSchema,
    title: seoTitleSchema.prefault({}),
    description: seoDescriptionSchema.prefault({}),
    ogMediaId: z.uuid().nullable().default(null),
    noindex: z.boolean().default(false),
  })
  .refine(
    (value) => !blank(value.title) || !blank(value.description) || value.ogMediaId || value.noindex,
    { message: "seo.error.empty", path: ["title", "az"] },
  );

export type SeoOverrideCreate = z.input<typeof seoOverrideCreateSchema>;
export type SeoOverrideParsed = z.output<typeof seoOverrideCreateSchema>;

export const seoOverrideIdParamsSchema = z.object({ id: z.uuid() });

/** An override as the console lists and edits it; blanks are empty strings. */
export type AdminSeoOverride = {
  id: string;
  path: string;
  title: SeoTexts;
  description: SeoTexts;
  ogMediaId: string | null;
  noindex: boolean;
  updatedAt: string;
};

/** A page the console offers to override: the site's routes, apartments and articles. */
export type SeoPage = { path: string; label: string; kind: "page" | "apartment" | "news" };

/** How a text compares with the length a search result shows. */
export function lengthStatus(
  value: string,
  field: keyof typeof seoLengths,
): "empty" | "ok" | "long" {
  const length = value.trim().length;
  if (length === 0) return "empty";
  return length > seoLengths[field] ? "long" : "ok";
}

/** The page's path in a locale: Azerbaijani has no prefix. */
export function localePath(path: string, locale: Locale): string {
  if (locale === "az") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
