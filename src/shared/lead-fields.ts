/**
 * The lead constants the browser reads on every page, apart from
 * `@/shared/leads` because that module brings zod: about 33 KB of JS that the
 * shell (`@/lib/leads/attribution`) and a form's first load have no use for
 * (CLAUDE.md §5). `@/shared/leads` re-exports them.
 */

/** The UTM parameters a lead keeps. */
export const utmKeys = ["source", "medium", "campaign", "term", "content"] as const;

/**
 * A viewing slot is picked in Baku time, wherever the visitor is: the complex
 * is in Azerbaijan, which keeps UTC+4 all year.
 */
export const viewingUtcOffset = "+04:00";
