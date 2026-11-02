import { and, eq, gt, sql } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { loginThrottles as t } from "@/db/schema";

import { lockMinutes, maxFailures } from "./throttle-config";

export { lockMinutes, maxFailures };

/** A failure older than this no longer counts towards the lock. */
const staleMinutes = 60;

export function normalizeEmail(email: unknown): string | null {
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

/** When the address's lock ends, or `null` when it may sign in. */
export async function lockedUntil(db: Executor, email: string): Promise<Date | null> {
  const [row] = await db
    .select({ lockedUntil: t.lockedUntil })
    .from(t)
    .where(and(eq(t.email, email), gt(t.lockedUntil, sql`now()`)));
  return row?.lockedUntil ?? null;
}

/**
 * Counts a failed sign-in. The count starts again after a lock has run out or
 * when the previous failure is stale. The address is counted whether or not an
 * account exists, so the lock does not reveal which addresses are real.
 */
export async function recordFailure(db: Executor, email: string): Promise<void> {
  // In ON CONFLICT DO UPDATE every column reference reads the existing row.
  const fresh = sql`(${t.lockedUntil} is not null or ${t.lastFailureAt} < now() - make_interval(mins => ${staleMinutes}))`;
  await db
    .insert(t)
    .values({ email, failures: 1 })
    .onConflictDoUpdate({
      target: t.email,
      set: {
        failures: sql`case when ${fresh} then 1 else ${t.failures} + 1 end`,
        lastFailureAt: sql`now()`,
        lockedUntil: sql`case when not ${fresh} and ${t.failures} + 1 >= ${maxFailures} then now() + make_interval(mins => ${lockMinutes}) end`,
      },
    });
}

export async function clearFailures(db: Executor, email: string): Promise<void> {
  await db.delete(t).where(eq(t.email, email));
}
