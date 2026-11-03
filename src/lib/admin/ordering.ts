import "server-only";

import { forbiddenError, invalidField } from "@/lib/api/errors";
import { can } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { sameMembers } from "@/shared/ordering";

/**
 * Refuses a reorder whose ids are not exactly the list's rows: the screen it
 * came from is stale (a row was added or removed meanwhile).
 */
export function assertSameMembers(current: readonly string[], ids: readonly string[]): void {
  if (!sameMembers(current, ids)) {
    throw invalidField("ids", "The list has changed since it was loaded. Reload and try again.");
  }
}

/**
 * Showing or hiding a FAQ entry or a gallery item on the site is publishing,
 * which `content:update` alone does not grant.
 */
export function assertMayPublish(user: SessionUser): void {
  if (!can(user.role, { content: ["publish"] })) throw forbiddenError();
}
