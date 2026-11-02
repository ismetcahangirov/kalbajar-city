import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { accounts, sessions, users } from "@/db/schema";
import { audit } from "@/lib/audit";

import { passwordLength } from "./paths";
import { clearFailures } from "./throttle";

export const ownerInput = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2),
  password: z.string().min(passwordLength.min).max(passwordLength.max),
});

export type OwnerInput = z.input<typeof ownerInput>;

/**
 * Creates the owner account, or makes an existing account an active owner
 * with this password and lifts a sign-in lock on it. A changed password signs
 * the account out everywhere.
 * Run by `pnpm auth:owner`, so the actor in the audit log is the system.
 */
export async function setOwner(
  db: Database,
  input: OwnerInput,
): Promise<{ userId: string; created: boolean }> {
  const { email, name, password } = ownerInput.parse(input);
  const hash = await hashPassword(password);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, email));
    const userId = existing?.id ?? randomUUID();
    const owner = { role: "owner" as const, banned: false, banReason: null, banExpires: null };

    const [after] = existing
      ? await tx
          .update(users)
          .set({ ...owner, emailVerified: true })
          .where(eq(users.id, userId))
          .returning()
      : await tx
          .insert(users)
          .values({ id: userId, name, email, emailVerified: true, ...owner })
          .returning();

    const credential = and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"));
    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(credential);
    if (account) {
      await tx.update(accounts).set({ password: hash }).where(eq(accounts.id, account.id));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    } else {
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hash,
      });
    }

    await clearFailures(tx, email);

    await audit(tx, {
      actorId: null,
      action: existing ? "user.owner_set" : "user.create",
      entityType: "user",
      entityId: userId,
      before: existing ?? null,
      after: after ?? null,
    });
    // The password itself is never logged; its change is.
    await audit(tx, {
      actorId: null,
      action: "user.password_set",
      entityType: "user",
      entityId: userId,
    });

    return { userId, created: !existing };
  });
}
