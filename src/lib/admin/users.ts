import "server-only";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { invitations, sessions, users } from "@/db/schema";
import { forbiddenError, HttpError, notFound } from "@/lib/api/errors";
import { auditMany, audit } from "@/lib/audit";
import { can, canManageUser, type Permission, type UserRole } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import type { AdminUser } from "@/shared/users";

export type Write = { user: SessionUser; headers: Headers };

type Tx = Parameters<Parameters<Executor["transaction"]>[0]>[0];

/** Identifies the lock below among the database's advisory locks. */
const userAdminLock = 27_001;

/**
 * Starts a write to accounts or invitations: serialises it with every other
 * one, then reads the actor afresh. The caller's session was checked before the
 * lock; by now a concurrent request may have demoted or deactivated the actor.
 * Holding the lock across the checks and the write is what keeps the last-owner
 * rule true under concurrent requests. Released when the transaction ends.
 */
export async function lockForUserAdmin(
  tx: Tx,
  user: SessionUser,
  permission: Permission,
): Promise<{ id: string; role: UserRole }> {
  await lockAccounts(tx);
  const [actor] = await tx
    .select({ id: users.id, role: users.role, banned: users.banned })
    .from(users)
    .where(eq(users.id, user.id));
  if (!actor || actor.banned || !can(actor.role, permission)) throw forbiddenError();
  return { id: actor.id, role: actor.role };
}

/** The lock alone, for a write with no signed-in actor (accepting an invitation). */
export async function lockAccounts(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${userAdminLock})`);
}

const lastOwner = () =>
  new HttpError(409, "LAST_OWNER", "The last active owner cannot be demoted or deactivated.");

/**
 * Refuses a change `canManageUser` does not allow, or one that would leave no
 * active owner. The rule's own answer comes before "not on yourself", so a sole
 * owner trying it is told why.
 */
async function checkChange(
  tx: Tx,
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole; banned: boolean },
  { nextRole, leavesOwners }: { nextRole?: UserRole; leavesOwners: boolean },
) {
  const self = actor.id === target.id;
  if (!self && !canManageUser(actor, target, nextRole)) throw forbiddenError();
  if (leavesOwners && target.role === "owner" && !target.banned) {
    const [row] = await tx
      .select({ owners: count() })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.banned, false)));
    if ((row?.owners ?? 0) <= 1) throw lastOwner();
  }
  if (self) throw forbiddenError();
}

async function loadTarget(tx: Tx, id: string) {
  const [target] = await tx.select().from(users).where(eq(users.id, id));
  if (!target) throw notFound("No such user.");
  return target;
}

/**
 * Invitations someone may no longer grant stop working when they lose the right:
 * a deactivated account's (`nextRole` absent), or those above a demoted one's
 * new role.
 */
async function revokeInvitationsFrom(
  tx: Tx,
  { inviterId, nextRole, actorId, headers }: Revocation,
): Promise<void> {
  const keepsInviting = nextRole !== undefined && can(nextRole, { user: ["create"] });
  if (keepsInviting && nextRole === "owner") return;
  const revoked = await tx
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invitations.invitedBy, inviterId),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        keepsInviting ? eq(invitations.role, "owner") : undefined,
      ),
    )
    .returning({ id: invitations.id, email: invitations.email, role: invitations.role });
  await auditMany(
    tx,
    revoked.map(({ id, email, role }) => ({
      actorId,
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: id,
      before: { email, role, revoked: false },
      after: { email, role, revoked: true },
      headers,
    })),
  );
}

type Revocation = {
  inviterId: string;
  nextRole?: UserRole;
  actorId: string;
  headers: Headers;
};

function toAdmin(
  row: typeof users.$inferSelect,
  viewer: { id: string; role: UserRole },
): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: !row.banned,
    lastSignInAt: row.lastSignInAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    self: row.id === viewer.id,
    manageable: canManageUser(viewer, { id: row.id, role: row.role }),
  };
}

/** Every console account; they are few, so the list is not paginated. */
export async function listUsers(db: Executor, viewer: SessionUser): Promise<AdminUser[]> {
  const rows = await db.select().from(users).orderBy(asc(users.name), asc(users.email));
  return rows.map((row) => toAdmin(row, viewer));
}

/** Refused with 409 `LAST_OWNER` when the account is the last active owner. */
export async function setUserRole(
  db: Executor,
  { id, role, user, headers }: Write & { id: string; role: UserRole },
): Promise<AdminUser> {
  return db.transaction(async (tx) => {
    const actor = await lockForUserAdmin(tx, user, { user: ["set-role"] });
    const target = await loadTarget(tx, id);
    await checkChange(tx, actor, target, { nextRole: role, leavesOwners: role !== "owner" });

    const [after] = await tx.update(users).set({ role }).where(eq(users.id, id)).returning();
    await audit(tx, {
      actorId: actor.id,
      action: "user.set_role",
      entityType: "user",
      entityId: id,
      before: { role: target.role },
      after: { role },
      headers,
    });
    await revokeInvitationsFrom(tx, {
      inviterId: id,
      nextRole: role,
      actorId: actor.id,
      headers,
    });
    return toAdmin(after!, actor);
  });
}

/**
 * Deactivates the account and ends its sessions in one transaction. Refused
 * with 409 `LAST_OWNER` when it is the last active owner.
 */
export async function deactivateUser(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<AdminUser> {
  return db.transaction(async (tx) => {
    const actor = await lockForUserAdmin(tx, user, { user: ["ban"] });
    const target = await loadTarget(tx, id);
    await checkChange(tx, actor, target, { leavesOwners: true });

    const [after] = await tx
      .update(users)
      .set({ banned: true, banReason: null, banExpires: null })
      .where(eq(users.id, id))
      .returning();
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await audit(tx, {
      actorId: actor.id,
      action: "user.deactivate",
      entityType: "user",
      entityId: id,
      before: { banned: target.banned },
      after: { banned: true },
      headers,
    });
    await revokeInvitationsFrom(tx, { inviterId: id, actorId: actor.id, headers });
    return toAdmin(after!, actor);
  });
}

/** Lets the account sign in again; a session created in a race with deactivating it stays gone. */
export async function reactivateUser(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<AdminUser> {
  return db.transaction(async (tx) => {
    const actor = await lockForUserAdmin(tx, user, { user: ["ban"] });
    const target = await loadTarget(tx, id);
    await checkChange(tx, actor, target, { leavesOwners: false });

    const [after] = await tx
      .update(users)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(users.id, id))
      .returning();
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await audit(tx, {
      actorId: actor.id,
      action: "user.reactivate",
      entityType: "user",
      entityId: id,
      before: { banned: target.banned },
      after: { banned: false },
      headers,
    });
    return toAdmin(after!, actor);
  });
}
