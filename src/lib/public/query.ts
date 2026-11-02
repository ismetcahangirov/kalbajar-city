/**
 * Public query parameters of the content pages (#21). Keys are Azerbaijani,
 * like route segments: `?sehife=2`, `?kateqoriya=interyer`. A value that
 * makes no sense is dropped, never an error.
 */

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** `?sehife=`: a whole page number from 1; anything else is page 1. */
export function pageParam(value: Param): number {
  const raw = first(value);
  if (!raw || !/^\d{1,6}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

/** `?kateqoriya=`: one of `known`, or no filter. */
export function categoryParam(value: Param, known: readonly string[]): string | null {
  const raw = first(value);
  return raw && known.includes(raw) ? raw : null;
}
