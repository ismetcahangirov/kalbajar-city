import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { accounts, invitations, users } from "@/db/schema";
import { forbiddenError, HttpError, invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { adminPaths } from "@/lib/auth/paths";
import type { UserRole } from "@/lib/auth/permissions";
import { clearFailures } from "@/lib/auth/throttle";
import { escapeHtml, sendMail } from "@/lib/mail";
import { siteOrigin } from "@/lib/seo/url";
import {
  invitationLifetimeDays,
  type AdminInvitation,
  type InvitationAccept,
  type InvitationSent,
} from "@/shared/users";

import { roleLabel, t } from "./messages";
import { lockAccounts, lockForUserAdmin, type Write } from "./users";

type Row = typeof invitations.$inferSelect;
type Viewer = { role: UserRole };

const pending = and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt));

/** 256 random bits, so a plain SHA-256 is enough: there is nothing to guess or to look up. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + invitationLifetimeDays * 24 * 60 * 60 * 1000),
  };
}

/** Only an owner grants, or handles an invitation that grants, the owner role. */
function mayHandle(viewer: Viewer, role: UserRole): boolean {
  return role !== "owner" || viewer.role === "owner";
}

function toAdmin(row: Row, viewer: Viewer, invitedByName: string | null): AdminInvitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    invitedByName,
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expiresAt.getTime() <= Date.now(),
    manageable: mayHandle(viewer, row.role),
  };
}

/** Pending invitations, also expired ones, which can be sent again. */
export async function listInvitations(db: Executor, viewer: Viewer): Promise<AdminInvitation[]> {
  const rows = await db
    .select({ invitation: invitations, invitedByName: users.name })
    .from(invitations)
    .leftJoin(users, eq(users.id, invitations.invitedBy))
    .where(pending)
    .orderBy(asc(invitations.email));
  return rows.map((row) => toAdmin(row.invitation, viewer, row.invitedByName));
}

/** The invitation an e-mailed token opens right now, for showing its page. */
export async function openInvitation(
  db: Executor,
  token: string,
): Promise<{ email: string; role: UserRole } | null> {
  const [row] = await db
    .select({ email: invitations.email, role: invitations.role })
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        pending,
        gt(invitations.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}

/** E-mails the link, after the commit. A failure leaves the invitation to be sent again. */
async function sendInvitation(
  { email, role, token }: { email: string; role: UserRole; token: string },
  inviter: string,
): Promise<boolean> {
  try {
    const url = `${siteOrigin()}${adminPaths.invitation}?token=${token}`;
    const lead = t("mail.invite.lead", { inviter, role: roleLabel(role) });
    const footer = t("mail.invite.footer", { days: invitationLifetimeDays });
    await sendMail({
      to: email,
      subject: t("mail.invite.subject"),
      text: [t("mail.invite.greeting"), lead, url, footer].join("\n\n"),
      html: [
        `<p>${escapeHtml(t("mail.invite.greeting"))}</p>`,
        `<p>${escapeHtml(lead)}</p>`,
        `<p><a href="${escapeHtml(url)}">${escapeHtml(t("mail.invite.action"))}</a></p>`,
        `<p>${escapeHtml(footer)}</p>`,
      ].join("\n"),
    });
    return true;
  } catch (cause) {
    console.error("The invitation e-mail was not sent", cause);
    return false;
  }
}

/** The fields the audit log keeps; the token's hash stays out of it. */
const logged = ({ email, role, expiresAt }: Row) => ({ email, role, expiresAt });

/**
 * Invites an address that has no account. Inviting an address already pending
 * replaces its token, role and deadline, so its earlier link stops working.
 */
export async function inviteUser(
  db: Executor,
  { email, role, user, headers }: Write & { email: string; role: UserRole },
): Promise<InvitationSent> {
  const { row, actor, token } = await db.transaction(async (tx) => {
    const actor = await lockForUserAdmin(tx, user, { user: ["create"] });
    if (!mayHandle(actor, role)) throw forbiddenError();

    const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account) throw invalidField("email", "invite.error.emailTaken");

    const fresh = newToken();
    const [existing] = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.email, email), pending));
    if (existing && !mayHandle(actor, existing.role)) throw forbiddenError();

    const values = {
      role,
      tokenHash: fresh.tokenHash,
      expiresAt: fresh.expiresAt,
      invitedBy: actor.id,
    };
    const [row] = existing
      ? await tx.update(invitations).set(values).where(eq(invitations.id, existing.id)).returning()
      : await tx
          .insert(invitations)
          .values({ email, ...values })
          .returning();
    await audit(tx, {
      actorId: actor.id,
      action: existing ? "invitation.resend" : "invitation.create",
      entityType: "invitation",
      entityId: row!.id,
      before: existing ? logged(existing) : null,
      after: logged(row!),
      headers,
    });
    return { row: row!, actor, token: fresh.token };
  });

  const mailSent = await sendInvitation({ email, role, token }, user.name);
  return { invitation: toAdmin(row, actor, user.name), mailSent };
}

/** A new link and a new deadline for a pending invitation. The old link stops working. */
export async function resendInvitation(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<InvitationSent> {
  const { row, actor, token } = await db.transaction(async (tx) => {
    const actor = await lockForUserAdmin(tx, user, { user: ["create"] });
    const [before] = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, id), pending));
    if (!before) throw notFound("No such invitation.");
    if (!mayHandle(actor, before.role)) throw forbiddenError();

    const fresh = newToken();
    const [row] = await tx
      .update(invitations)
      .set({ tokenHash: fresh.tokenHash, expiresAt: fresh.expiresAt, invitedBy: actor.id })
      .where(eq(invitations.id, id))
      .returning();
    await audit(tx, {
      actorId: actor.id,
      action: "invitation.resend",
      entityType: "invitation",
      entityId: id,
      before: logged(before),
      after: logged(row!),
      headers,
    });
    return { row: row!, actor, token: fresh.token };
  });

  const mailSent = await sendInvitation({ email: row.email, role: row.role, token }, user.name);
  return { invitation: toAdmin(row, actor, user.name), mailSent };
}

export async function revokeInvitation(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const actor = await lockForUserAdmin(tx, user, { user: ["create"] });
    const [before] = await tx
      .select()
      .from(invitations)
      .where(and(eq(invitations.id, id), pending));
    if (!before) throw notFound("No such invitation.");
    if (!mayHandle(actor, before.role)) throw forbiddenError();

    await tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, id));
    await audit(tx, {
      actorId: actor.id,
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: id,
      before: { email: before.email, role: before.role, revoked: false },
      after: { email: before.email, role: before.role, revoked: true },
      headers,
    });
  });
}

const invalid = () =>
  new HttpError(410, "INVITATION_INVALID", "The invitation is invalid, expired or already used.");

/**
 * Creates the account an invitation promises. The conditional update is what
 * makes the token single use: of two concurrent requests only one gets the row,
 * and if creating the account fails, the invitation stays unused.
 */
export async function acceptInvitation(
  db: Executor,
  { token, name, password }: InvitationAccept,
  headers: Headers,
): Promise<void> {
  // Before the deliberately slow hash, so a wrong token costs the server nothing.
  if (!(await openInvitation(db, token))) throw invalid();
  const hash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await lockAccounts(tx);
    const [invitation] = await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(invitations.tokenHash, hashToken(token)),
          pending,
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!invitation) throw invalid();
    const { email, role } = invitation;

    const [account] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (account) throw invalid();

    const id = randomUUID();
    await tx.insert(users).values({ id, name, email, role, emailVerified: true });
    await tx.insert(accounts).values({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: hash,
    });
    await clearFailures(tx, email);

    await audit(tx, {
      actorId: id,
      action: "user.create",
      entityType: "user",
      entityId: id,
      before: null,
      after: { id, name, email, role, invitationId: invitation.id },
      headers,
    });
    await audit(tx, {
      actorId: id,
      action: "invitation.accept",
      entityType: "invitation",
      entityId: invitation.id,
      before: { email, role, accepted: false },
      after: { email, role, accepted: true },
      headers,
    });
  });
}
