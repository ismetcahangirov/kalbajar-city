import "server-only";

import { revalidateTag } from "next/cache";

import type { PublicTag } from "./tags";

/**
 * Called by every admin write for the server tags it affects, next to the RTK
 * Query tags its mutation invalidates (`CLAUDE.md` §4). `expire: 0` makes the
 * next request render fresh data instead of being served the stale copy while
 * it revalidates, so an edit shows on the very next page view.
 */
export function revalidatePublic(...tags: PublicTag[]): void {
  for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 });
}
