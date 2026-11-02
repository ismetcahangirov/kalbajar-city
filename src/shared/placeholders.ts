import { z } from "zod";

import type { HomeSectionKey } from "./home-sections";

/*
 * Placeholder values (#27). The owner decided (2026-11-02) that the facts
 * still waiting for their decision (#7) are filled with modest stand-ins, so
 * the site is complete, and stay flagged in the console until someone saves
 * a real value or confirms the stand-in. A flag is a dotted path: the first
 * segment is the scope (a settings key, or `homeLocation` for the home page's
 * location section), the rest the field in that scope's value.
 */

export const placeholderPathSchema = z
  .string()
  .max(120)
  .regex(/^[A-Za-z]\w*(\.\w+)+$/, "Use a dotted path such as contacts.address");

/** The `placeholders` settings row: the paths still holding a stand-in value. */
export const placeholdersSchema = z.object({ paths: z.array(placeholderPathSchema).max(200) });

export type Placeholders = z.infer<typeof placeholdersSchema>;

/** `POST /api/v1/admin/placeholders/confirm`: the stand-ins the editor accepts as real. */
export const placeholderConfirmSchema = z.object({
  paths: z.array(placeholderPathSchema).min(1).max(200),
});

export type PlaceholderConfirm = z.infer<typeof placeholderConfirmSchema>;

/** A home section's scope: `location` → `homeLocation`. */
export function homeSectionScope(key: HomeSectionKey): string {
  return `home${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/** The scope a path belongs to (`contacts.address` → `contacts`). */
export function scopeOf(path: string): string {
  return path.split(".", 1)[0] ?? path;
}

/** The value at `segments` inside `value`, or `undefined` when the path does not exist. */
export function valueAt(value: unknown, segments: readonly string[]): unknown {
  let current = value;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Nothing worth keeping: missing, null, a blank string, an empty list or object. */
export function isBlankValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isBlankValue);
  return false;
}

/**
 * Whether two JSON values are the same, ignoring key order (Postgres `jsonb`
 * does not keep it) and treating a missing key as `null`.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameValue(left[key], right[key]));
}

/** The flagged paths in `scope` whose value differs between `before` and `after`. */
export function changedPlaceholders(
  paths: readonly string[],
  scope: string,
  before: unknown,
  after: unknown,
): string[] {
  return paths.filter((path) => {
    const [head, ...field] = path.split(".");
    return head === scope && !sameValue(valueAt(before, field), valueAt(after, field));
  });
}
