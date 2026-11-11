import { z } from "zod";

/**
 * `SITE_NOINDEX`: set on staging (#13) so nothing it serves is indexed. The
 * same image runs on staging and production, so the flag is read at run
 * time, by name, never inlined by the bundler. Unset or empty means the site
 * is indexable; anything other than the four accepted spellings is an error,
 * because a typo that silently left staging indexable, or production hidden,
 * would go unnoticed.
 */
export const noindexFlagSchema = z
  .enum(["", "true", "false", "1", "0"], {
    error: 'SITE_NOINDEX must be "true", "false", "1", "0" or empty',
  })
  .optional()
  .transform((value) => value === "true" || value === "1");

const variable = "SITE_NOINDEX";

/** False on a deployment that must stay out of search engines (staging). */
export function siteIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return !noindexFlagSchema.parse(env[variable]?.trim());
}

/** What a page or response says when the whole site is hidden. */
export const siteNoindexRobots = { index: false, follow: false } as const;
export const siteNoindexHeader = "noindex, nofollow";
