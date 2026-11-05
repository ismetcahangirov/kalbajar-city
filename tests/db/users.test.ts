import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, invitations, sessions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/permissions";
import type { AdminInvitation, AdminUser, InvitationSent } from "@/shared/users";

import { createUser, origin, password, signIn, type TestUser } from "./accounts";

const mail = vi.hoisted(() => ({
  sent: [] as { to: string; text: string; html: string }[],
  fail: false,
}));
vi.mock("@/lib/mail", () => ({
  sendMail: async (message: { to: string; text: string; html: string }) => {
    if (mail.fail) throw new Error("SMTP is down");
    mail.sent.push(message);
  },
  escapeHtml: (value: string) => value,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  forbidden: () => {
    throw new Error("forbidden");
  },
  unstable_rethrow: () => {},
}));

const usersRoute = await import("@/app/api/v1/admin/users/route");
const roleRoute = await import("@/app/api/v1/admin/users/[id]/role/route");
const deactivateRoute = await import("@/app/api/v1/admin/users/[id]/deactivate/route");
const reactivateRoute = await import("@/app/api/v1/admin/users/[id]/reactivate/route");
const invitationsRoute = await import("@/app/api/v1/admin/invitations/route");
const invitationRoute = await import("@/app/api/v1/admin/invitations/[id]/route");
const resendRoute = await import("@/app/api/v1/admin/invitations/[id]/resend/route");
const acceptRoute = await import("@/app/api/v1/invitations/accept/route");
const { setUserRole, deactivateUser } = await import("@/lib/admin/users");
const { HttpError } = await import("@/lib/api/errors");

const { db, close } = connect(inject("databaseUrl"));
// Real concurrency needs connections of its own: `connect` defaults to one.
const pool = connect(inject("databaseUrl"), { max: 8 });
afterAll(async () => {
  await close();
  await pool.close();
});

type Init = { cookie?: string; body?: unknown };

function request(path: string, method: string, { cookie, body }: Init = {}) {
  const headers = new Headers({ "x-forwarded-for": "198.51.100.7", "user-agent": "vitest" });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const setRole = (cookie: string, id: string, role: UserRole) =>
  roleRoute.PUT(
    request(`/api/v1/admin/users/${id}/role`, "PUT", { cookie, body: { role } }),
    params(id),
  );
const deactivate = (cookie: string, id: string) =>
  deactivateRoute.POST(
    request(`/api/v1/admin/users/${id}/deactivate`, "POST", { cookie }),
    params(id),
  );
const reactivate = (cookie: string, id: string) =>
  reactivateRoute.POST(
    request(`/api/v1/admin/users/${id}/reactivate`, "POST", { cookie }),
    params(id),
  );
const invite = (cookie: string, email: string, role: UserRole) =>
  invitationsRoute.POST(
    request("/api/v1/admin/invitations", "POST", { cookie, body: { email, role } }),
  );
const accept = (token: string, name = "Invited Person", secret = password) =>
  acceptRoute.POST(
    request("/api/v1/invitations/accept", "POST", {
      body: { token, name, password: secret, confirm: secret },
    }),
  );

async function row(id: string) {
  const [found] = await db.select().from(users).where(eq(users.id, id));
  return found!;
}

const sessionsOf = async (id: string) => db.select().from(sessions).where(eq(sessions.userId, id));

async function lastAudit(entityId: string, action: string) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, entityId), eq(auditLog.action, action)));
  return rows.at(-1);
}

const code = async (response: Response) =>
  ((await response.clone().json()) as { error?: { code?: string } }).error?.code;

const address = () => `${randomUUID().slice(0, 12)}@example.com`;

/** The link's token from the last e-mail to this address. */
function tokenIn(email: string): string {
  const message = mail.sent.filter((sent) => sent.to === email).at(-1);
  if (!message) throw new Error(`No mail to ${email}`);
  const url = /https?:\S+\/admin\/devet\?token=(\S+)/.exec(message.text);
  if (!url?.[1]) throw new Error("No invitation link in the e-mail");
  return url[1];
}

const asSession = (user: TestUser): SessionUser => ({
  id: user.id,
  name: "Test",
  email: user.email,
  role: user.role,
});

beforeEach(async () => {
  mail.sent.length = 0;
  mail.fail = false;
  // Each test counts its own owners: whoever earlier tests or files left active
  // must not hold up the rule.
  await db.update(users).set({ banned: true }).where(eq(users.role, "owner"));
});

describe("the last owner", () => {
  it("cannot demote or deactivate themselves, and is told why", async () => {
    const owner = await createUser("owner");
    const demote = await setRole(owner.cookie, owner.id, "admin");
    expect(demote.status).toBe(409);
    expect(await code(demote)).toBe("LAST_OWNER");

    const off = await deactivate(owner.cookie, owner.id);
    expect(off.status).toBe(409);
    expect(await code(off)).toBe("LAST_OWNER");

    expect(await row(owner.id)).toMatchObject({ role: "owner", banned: false });
    expect(await sessionsOf(owner.id)).not.toHaveLength(0);
  });

  it("is refused to a direct call even by an actor who may otherwise manage owners", async () => {
    const owner = await createUser("owner");
    const other = await createUser("owner");
    await db.update(users).set({ banned: true }).where(eq(users.id, other.id));
    const headers = new Headers();
    // The stale session says owner; the row says deactivated.
    await expect(
      setUserRole(db, { id: owner.id, role: "admin", user: asSession(other), headers }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await row(owner.id)).toMatchObject({ role: "owner" });
  });

  it("does not count a deactivated owner", async () => {
    const owner = await createUser("owner");
    const dormant = await createUser("owner");
    const off = await deactivate(owner.cookie, dormant.id);
    expect(off.status).toBe(200);
    const demote = await setRole(owner.cookie, owner.id, "editor");
    expect(await code(demote)).toBe("LAST_OWNER");
  });

  it("survives two owners demoting each other at once, every round", async () => {
    for (let round = 0; round < 12; round++) {
      await db.update(users).set({ banned: true }).where(eq(users.role, "owner"));
      const [a, b] = [await createUser("owner"), await createUser("owner")];
      const headers = new Headers();
      const results = await Promise.allSettled([
        setUserRole(pool.db, { id: b.id, role: "editor", user: asSession(a), headers }),
        setUserRole(pool.db, { id: a.id, role: "editor", user: asSession(b), headers }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected?.reason).toBeInstanceOf(HttpError);
      const owners = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "owner"), eq(users.banned, false)));
      expect(owners).toHaveLength(1);
    }
  }, 120_000);

  it("survives two owners deactivating each other at once, every round", async () => {
    for (let round = 0; round < 12; round++) {
      await db.update(users).set({ banned: true }).where(eq(users.role, "owner"));
      const [a, b] = [await createUser("owner"), await createUser("owner")];
      const headers = new Headers();
      const results = await Promise.allSettled([
        deactivateUser(pool.db, { id: b.id, user: asSession(a), headers }),
        deactivateUser(pool.db, { id: a.id, user: asSession(b), headers }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const owners = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "owner"), eq(users.banned, false)));
      expect(owners).toHaveLength(1);
    }
  }, 120_000);

  it("survives a demotion racing a deactivation over the routes", async () => {
    const [a, b] = [await createUser("owner"), await createUser("owner")];
    const responses = await Promise.all([
      setRole(a.cookie, b.id, "sales"),
      deactivate(b.cookie, a.id),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    const owners = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.banned, false)));
    expect(owners).toHaveLength(1);
  });
});

describe("setting a role", () => {
  it("applies on the target's next request and is audited with the diff", async () => {
    const owner = await createUser("owner");
    const target = await createUser("sales");
    const response = await setRole(owner.cookie, target.id, "editor");
    expect(response.status).toBe(200);
    expect(((await response.json()) as AdminUser).role).toBe("editor");
    expect(await lastAudit(target.id, "user.set_role")).toMatchObject({
      actorId: owner.id,
      before: { role: "sales" },
      after: { role: "editor" },
      ip: "198.51.100.7",
    });
    const list = await usersRoute.GET(
      request("/api/v1/admin/users", "GET", { cookie: target.cookie }),
    );
    expect(list.status).toBe(403);
  });

  it("keeps an admin from owners and the owner role, and everyone from themselves", async () => {
    const owner = await createUser("owner");
    const second = await createUser("owner");
    const admin = await createUser("admin");
    const sales = await createUser("sales");

    expect((await setRole(admin.cookie, owner.id, "editor")).status).toBe(403);
    expect((await deactivate(admin.cookie, owner.id)).status).toBe(403);
    expect((await setRole(admin.cookie, sales.id, "owner")).status).toBe(403);
    expect((await setRole(admin.cookie, admin.id, "owner")).status).toBe(403);
    expect((await deactivate(admin.cookie, admin.id)).status).toBe(403);
    // Not the last owner, so the plain rule answers.
    const self = await setRole(owner.cookie, owner.id, "admin");
    expect(self.status).toBe(403);
    expect(await code(self)).toBe("FORBIDDEN");

    expect((await setRole(sales.cookie, admin.id, "sales")).status).toBe(403);
    expect((await setRole(owner.cookie, second.id, "admin")).status).toBe(200);
  });

  it("lists who may be changed for the asking user", async () => {
    const owner = await createUser("owner");
    const admin = await createUser("admin");
    const response = await usersRoute.GET(
      request("/api/v1/admin/users", "GET", { cookie: admin.cookie }),
    );
    const list = (await response.json()) as AdminUser[];
    expect(list.find((item) => item.id === owner.id)).toMatchObject({ manageable: false });
    expect(list.find((item) => item.id === admin.id)).toMatchObject({
      manageable: false,
      self: true,
    });
    expect(JSON.stringify(list)).not.toMatch(/password|token/i);
  });
});

describe("deactivating a user", () => {
  it("ends their sessions at once, keeps them out and can be undone", async () => {
    const owner = await createUser("owner");
    const target = await createUser("editor");
    expect(await sessionsOf(target.id)).toHaveLength(1);

    const response = await deactivate(owner.cookie, target.id);
    expect(response.status).toBe(200);
    expect(await sessionsOf(target.id)).toHaveLength(0);
    expect((await row(target.id)).banned).toBe(true);
    expect(await lastAudit(target.id, "user.deactivate")).toMatchObject({
      actorId: owner.id,
      before: { banned: false },
      after: { banned: true },
    });

    const authed = await usersRoute.GET(
      request("/api/v1/admin/users", "GET", { cookie: target.cookie }),
    );
    expect(authed.status).toBe(401);
    expect((await signIn(target.email)).status).toBe(403);

    expect((await reactivate(owner.cookie, target.id)).status).toBe(200);
    expect(await lastAudit(target.id, "user.reactivate")).toMatchObject({ actorId: owner.id });
    expect((await signIn(target.email)).status).toBe(200);
    // The old session stays dead; only a new sign-in opens one.
    const stale = await usersRoute.GET(
      request("/api/v1/admin/users", "GET", { cookie: target.cookie }),
    );
    expect(stale.status).toBe(401);
  });

  it("revokes the pending invitations they sent", async () => {
    const owner = await createUser("owner");
    const admin = await createUser("admin");
    const email = address();
    expect((await invite(admin.cookie, email, "editor")).status).toBe(201);
    const token = tokenIn(email);

    expect((await deactivate(owner.cookie, admin.id)).status).toBe(200);
    expect((await accept(token)).status).toBe(410);
  });

  it("revokes owner invitations when an owner is demoted, but not the others", async () => {
    const owner = await createUser("owner");
    const second = await createUser("owner");
    const [toOwner, toEditor] = [address(), address()];
    await invite(second.cookie, toOwner, "owner");
    await invite(second.cookie, toEditor, "editor");

    expect((await setRole(owner.cookie, second.id, "admin")).status).toBe(200);
    expect((await accept(tokenIn(toOwner))).status).toBe(410);
    expect((await accept(tokenIn(toEditor))).status).toBe(201);
  });
});

describe("invitations", () => {
  it("store only a hash, mail a working link and create the account once", async () => {
    const owner = await createUser("owner");
    const email = address();
    const response = await invite(owner.cookie, email.toUpperCase(), "sales");
    expect(response.status).toBe(201);
    const sent = (await response.json()) as InvitationSent;
    expect(sent).toMatchObject({ mailSent: true, invitation: { email, role: "sales" } });
    expect(JSON.stringify(sent)).not.toMatch(/token/i);

    const token = tokenIn(email);
    expect(mail.sent.at(-1)?.html).toContain(token);
    const [stored] = await db.select().from(invitations).where(eq(invitations.email, email));
    expect(stored!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.tokenHash).not.toContain(token);
    const days = (stored!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    const logged = await lastAudit(stored!.id, "invitation.create");
    expect(logged).toMatchObject({ actorId: owner.id, after: { email, role: "sales" } });
    expect(JSON.stringify(logged)).not.toContain(stored!.tokenHash);
    expect(JSON.stringify(logged)).not.toContain(token);

    const created = await accept(token, "New Colleague");
    expect(created.status).toBe(201);
    const signedIn = await signIn(email);
    expect(signedIn.status).toBe(200);
    const [account] = await db.select().from(users).where(eq(users.email, email));
    expect(account).toMatchObject({ role: "sales", name: "New Colleague", emailVerified: true });
    expect(await lastAudit(account!.id, "user.create")).toMatchObject({
      actorId: account!.id,
      after: { email, role: "sales" },
    });

    const again = await accept(token);
    expect(again.status).toBe(410);
    expect(await code(again)).toBe("INVITATION_INVALID");
  });

  it("cannot be accepted twice at once", async () => {
    const owner = await createUser("owner");
    const email = address();
    await invite(owner.cookie, email, "editor");
    const token = tokenIn(email);
    const responses = await Promise.all([accept(token), accept(token), accept(token)]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 410, 410]);
    expect(await db.select().from(users).where(eq(users.email, email))).toHaveLength(1);
  });

  it("stop working when they expire, when revoked and when sent again", async () => {
    const owner = await createUser("owner");

    const late = address();
    await invite(owner.cookie, late, "editor");
    await db
      .update(invitations)
      .set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(invitations.email, late));
    expect((await accept(tokenIn(late))).status).toBe(410);

    const revoked = address();
    const made = (await (await invite(owner.cookie, revoked, "editor")).json()) as InvitationSent;
    const removal = await invitationRoute.DELETE(
      request(`/api/v1/admin/invitations/${made.invitation.id}`, "DELETE", {
        cookie: owner.cookie,
      }),
      params(made.invitation.id),
    );
    expect(removal.status).toBe(204);
    expect(await lastAudit(made.invitation.id, "invitation.revoke")).toMatchObject({
      actorId: owner.id,
    });
    expect((await accept(tokenIn(revoked))).status).toBe(410);

    const resent = address();
    const first = (await (await invite(owner.cookie, resent, "editor")).json()) as InvitationSent;
    const oldToken = tokenIn(resent);
    const again = await resendRoute.POST(
      request(`/api/v1/admin/invitations/${first.invitation.id}/resend`, "POST", {
        cookie: owner.cookie,
      }),
      params(first.invitation.id),
    );
    expect(again.status).toBe(200);
    const newToken = tokenIn(resent);
    expect(newToken).not.toBe(oldToken);
    expect((await accept(oldToken)).status).toBe(410);
    expect((await accept(newToken)).status).toBe(201);
  });

  it("replace a pending invitation to the same address, whose old link dies", async () => {
    const owner = await createUser("owner");
    const email = address();
    await invite(owner.cookie, email, "editor");
    const first = tokenIn(email);
    expect((await invite(owner.cookie, email, "sales")).status).toBe(201);
    expect((await accept(first)).status).toBe(410);
    expect((await accept(tokenIn(email))).status).toBe(201);
    const [account] = await db.select().from(users).where(eq(users.email, email));
    expect(account?.role).toBe("sales");
  });

  it("refuse an address with an account, and the owner role from an admin", async () => {
    const owner = await createUser("owner");
    const admin = await createUser("admin");
    const editor = await createUser("editor");
    const taken = await invite(owner.cookie, editor.email, "editor");
    expect(taken.status).toBe(422);
    expect(await taken.json()).toMatchObject({
      error: { fields: { email: ["invite.error.emailTaken"] } },
    });
    expect((await invite(admin.cookie, address(), "owner")).status).toBe(403);
    expect((await invite(editor.cookie, address(), "editor")).status).toBe(403);
    expect(mail.sent).toHaveLength(0);

    const email = address();
    const ownerInvite = (await (
      await invite(owner.cookie, email, "owner")
    ).json()) as InvitationSent;
    const listed = (await (
      await invitationsRoute.GET(
        request("/api/v1/admin/invitations", "GET", { cookie: admin.cookie }),
      )
    ).json()) as AdminInvitation[];
    expect(listed.find((item) => item.email === email)).toMatchObject({ manageable: false });
    const resend = await resendRoute.POST(
      request(`/api/v1/admin/invitations/${ownerInvite.invitation.id}/resend`, "POST", {
        cookie: admin.cookie,
      }),
      params(ownerInvite.invitation.id),
    );
    expect(resend.status).toBe(403);
    // Nor may an admin take an owner invitation over by inviting the address again.
    expect((await invite(admin.cookie, email, "editor")).status).toBe(403);
  });

  it("stand when the e-mail fails, and can be sent again", async () => {
    const owner = await createUser("owner");
    const email = address();
    mail.fail = true;
    const response = await invite(owner.cookie, email, "editor");
    expect(response.status).toBe(201);
    const sent = (await response.json()) as InvitationSent;
    expect(sent.mailSent).toBe(false);
    mail.fail = false;
    const again = await resendRoute.POST(
      request(`/api/v1/admin/invitations/${sent.invitation.id}/resend`, "POST", {
        cookie: owner.cookie,
      }),
      params(sent.invitation.id),
    );
    expect(((await again.json()) as InvitationSent).mailSent).toBe(true);
    expect((await accept(tokenIn(email))).status).toBe(201);
  });

  it("validate what the invited person sends, without using the invitation up", async () => {
    const owner = await createUser("owner");
    const email = address();
    await invite(owner.cookie, email, "editor");
    const token = tokenIn(email);
    expect((await accept(token, "New Colleague", "short")).status).toBe(422);
    expect((await accept(token, "N")).status).toBe(422);
    expect((await accept("not-a-real-token")).status).toBe(410);
    expect((await accept(token)).status).toBe(201);
  });
});
