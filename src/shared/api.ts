import { z } from "zod";

import { locales } from "@/i18n/routing";

/**
 * Conventions every `/api/v1` endpoint shares (#10). Handlers parse with these
 * schemas and RTK Query reads the same types, so both ends agree on the wire
 * format.
 */

/**
 * The one error shape: `{ error: { code, message, fields? } }`. A few codes add
 * details beside them, e.g. `MEDIA_IN_USE` lists the file's `usages`.
 */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    /** Messages per field, keyed by the field's dotted path (`utm.source`). */
    fields?: Record<string, string[]>;
  };
};

export const maxPageSize = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(24),
});

export type Pagination = z.output<typeof paginationSchema>;

/** One page of a list. */
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export function toPage<T>(items: T[], total: number, { page, pageSize }: Pagination): Page<T> {
  return { items, page, pageSize, total, pageCount: Math.ceil(total / pageSize) };
}

export function offsetOf({ page, pageSize }: Pagination): number {
  return (page - 1) * pageSize;
}

export type Sort<F extends string> = { field: F; direction: "asc" | "desc" };

/**
 * `?sort=area` sorts ascending, `?sort=-area` descending, by one of `fields`.
 */
export function sortSchema<const F extends readonly [string, ...string[]]>(
  fields: F,
  fallback: F[number] | `-${F[number]}`,
) {
  const values = fields.flatMap((field) => [field, `-${field}`]) as [string, ...string[]];
  return z
    .enum(values)
    .default(fallback)
    .transform((value): Sort<F[number]> => {
      const descending = value.startsWith("-");
      return {
        field: (descending ? value.slice(1) : value) as F[number],
        direction: descending ? "desc" : "asc",
      };
    });
}

/**
 * A filter that takes several values, as repeated keys (`?rooms=2&rooms=3`)
 * or comma-separated (`?rooms=2,3`). Absent means "no filter".
 */
export function listOf<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (value) =>
      (Array.isArray(value) ? value : [value])
        .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : [entry]))
        .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
        .filter((entry) => entry !== "" && entry !== undefined),
    z.array(item).max(50),
  );
}

/** The language public endpoints answer in; content falls back to `az`. */
export const localeQuerySchema = z.enum(locales).default("az");

/** Prices cross the API as strings of minor units (`CLAUDE.md` §4). */
export const minorAmountSchema = z.string().regex(/^\d{1,15}$/, "Amount must be whole minor units");

export type Money = { amount: string; currency: string };
