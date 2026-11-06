import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, loginThrottles, sessions, users } from "@/db/schema";
import type { Permission, UserRole } from "@/lib/auth/permissions";

import {
  call,
  createUser,
  origin,
  password,
  sessionCookie,
  signIn,
  type TestUser,
} from "./accounts";

const mail = vi.hoisted(() => ({ sent: [] as { to: string; text: string }[] }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (message: { to: string; text: string }) => void mail.sent.push(message),
  escapeHtml: (value: string) => value,
}));

// Console pages read the session through next/headers and leave through
// redirect() or forbidden(); here they read a cookie the test sets and throw.
const page = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(page.cookie ? { cookie: page.cookie } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  forbidden: () => {
    throw new Error("forbidden");
  },
  unstable_rethrow: () => {},
}));

const { getAuth } = await import("@/lib/auth");
const { authorize, requireUser } = await import("@/lib/auth/session");
const { setOwner } = await import("@/lib/auth/owner");
const { maxFailures } = await import("@/lib/auth/throttle");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

async function lastAudit(entityId: string, action: string) {
  const [row] = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, entityId), eq(auditLog.action, action)))
    .orderBy(desc(auditLog.id))
    .limit(1);
  return row;
}

const roles: UserRole[] = ["owner", "admin", "editor", "sales"];
const people = {} as Record<UserRole, TestUser>;

beforeAll(async () => {
  for (const role of roles) people[role] = await createUser(role);
});

beforeEach(() => {
  page.cookie = "";
  mail.sent.length = 0;
});

/** One action each role may take and one it may not, for pages and handlers. */
const matrix: Record<UserRole, { allowed: Permission; forbidden?: Permission }> = {
  owner: { allowed: { settings: ["update"] } },
  admin: { allowed: { user: ["create"] }, forbidden: { user: ["impersonate"] } },
  editor: { allowed: { content: ["publish"] }, forbidden: { leads: ["read"] } },
  sales: { allowed: { apartmentStatus: ["update"] }, forbidden: { content: ["update"] } },
};

describe("console pages", () => {
  it("send a signed-out visitor to the sign-in page", async () => {
    await expect(requireUser()).rejects.toThrow("redirect:/admin/giris");
    page.cookie = "better-auth.session_token=forged.value";
    await expect(requireUser()).rejects.toThrow("redirect:/admin/giris");
  });

  for (const role of roles) {
    it(`let ${role} open what the role allows and answer 403 otherwise`, async () => {
      page.cookie = people[role].cookie;
      const user = await requireUser(matrix[role].allowed);
      expect(user).toMatchObject({ id: people[role].id, role });
      const { forbidden } = matrix[role];
      if (forbidden) await expect(requireUser(forbidden)).rejects.toThrow("forbidden");
    });
  }
});

const routesRoot = join(process.cwd(), "src", "app", "api", "v1", "admin");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

type Handler = (request: Request, context: unknown) => Promise<Response>;

describe("/api/v1/admin handlers", () => {
  const routes = routeFiles(routesRoot);
  const context = { params: Promise.resolve({}) };

  it("are discovered", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  for (const file of routes) {
    const path = `/api/v1/admin/${relative(routesRoot, file).split(sep).slice(0, -1).join("/")}`;

    it(`${path} rejects anonymous and forged sessions in the shared error shape`, async () => {
      const exports = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
      const handlers = Object.entries(exports).filter(([, value]) => typeof value === "function");
      expect(handlers.length).toBeGreaterThan(0);
      for (const [method, handler] of handlers as [string, Handler][]) {
        for (const cookie of [undefined, "better-auth.session_token=forged.value"]) {
          const headers = new Headers(cookie ? { cookie } : {});
          const response = await handler(
            new Request(`${origin}${path}`, { method, headers }),
            context,
          );
          expect(response.status, `${method} ${path}`).toBe(401);
          expect(await response.json()).toEqual({
            error: { code: "UNAUTHORIZED", message: expect.any(String) },
          });
        }
      }
    });
  }

  it("/api/v1/admin/me answers every role with its own account", async () => {
    const { GET } = await import("@/app/api/v1/admin/me/route");
    for (const role of roles) {
      const headers = new Headers({ cookie: people[role].cookie });
      const response = await GET(new Request(`${origin}/api/v1/admin/me`, { headers }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        user: { id: people[role].id, name: `Test ${role}`, email: people[role].email, role },
      });
    }
  });

  for (const role of roles) {
    it(`authorize() lets ${role} do what the role allows and answers 403 otherwise`, async () => {
      const request = new Request(`${origin}/api/v1/admin/x`, {
        headers: { cookie: people[role].cookie },
      });
      const allowed = await authorize(request, matrix[role].allowed);
      expect(allowed.user?.role).toBe(role);
      const { forbidden } = matrix[role];
      if (!forbidden) return;
      const denied = await authorize(request, forbidden);
      expect(denied.response?.status).toBe(403);
      expect(await denied.response?.json()).toEqual({
        error: { code: "FORBIDDEN", message: expect.any(String) },
      });
    });
  }
});

describe("user management through Better Auth's admin endpoints", () => {
  it("keeps editors and sales out", async () => {
    for (const role of ["editor", "sales"] as const) {
      const response = await call("/admin/list-users", { cookie: people[role].cookie });
      expect(response.status, role).toBe(403);
    }
  });

  it("lets nobody impersonate another account", async () => {
    const response = await call("/admin/impersonate-user", {
      cookie: people.owner.cookie,
      body: { userId: people.editor.id },
    });
    expect(response.status).toBe(403);
  });

  it("lets an admin set a sales account's password but not the owner's", async () => {
    const target = await createUser("sales");
    const set = await call("/admin/set-user-password", {
      cookie: people.admin.cookie,
      body: { userId: target.id, newPassword: "another long passphrase" },
    });
    expect(set.status).toBe(200);
    const owner = await call("/admin/set-user-password", {
      cookie: people.admin.cookie,
      body: { userId: people.owner.id, newPassword: "another long passphrase" },
    });
    expect(owner.status).toBe(403);
    expect(await owner.json()).toMatchObject({ code: "OWNER_PROTECTED" });
  });

  // The last-owner rule lives behind /api/v1/admin/users (tests/db/users.test.ts);
  // an endpoint that changes a role or ends an account would go round it.
  for (const [path, extra] of [
    ["/admin/set-role", { role: "editor" }],
    ["/admin/update-user", { data: { role: "editor", banned: true } }],
    ["/admin/ban-user", {}],
    ["/admin/unban-user", {}],
    ["/admin/remove-user", {}],
  ] as const) {
    it(`closes ${path} even to an owner acting on another owner`, async () => {
      const target = await createUser("owner");
      const response = await call(path, {
        cookie: people.owner.cookie,
        body: { userId: target.id, ...extra },
      });
      expect(response.status).toBe(404);
      const [row] = await db.select().from(users).where(eq(users.id, target.id));
      expect(row).toMatchObject({ role: "owner", banned: false });
    });
  }

  it("does not let an account change its own role or ban itself through its profile", async () => {
    const target = await createUser("owner");
    await call("/update-user", {
      cookie: target.cookie,
      body: { role: "editor", banned: true, name: "Renamed" },
    });
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row).toMatchObject({ role: "owner", banned: false });
  });

  it("offers no way to delete one's own account", async () => {
    const target = await createUser("owner");
    const response = await call("/delete-user", {
      cookie: target.cookie,
      body: { password },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const [row] = await db.select().from(users).where(eq(users.id, target.id));
    expect(row).toBeDefined();
  });
});

describe("audit log", () => {
  for (const role of roles) {
    it(`records ${role}'s own profile change with the diff, actor and IP`, async () => {
      const response = await call("/update-user", {
        cookie: people[role].cookie,
        body: { name: `Renamed ${role}` },
      });
      expect(response.status).toBe(200);
      const row = await lastAudit(people[role].id, "user.update");
      expect(row).toMatchObject({
        actorId: people[role].id,
        entityType: "user",
        before: { name: `Test ${role}` },
        after: { name: `Renamed ${role}` },
      });
      expect(row?.ip).toMatch(/^198\.51\.100\.\d+$/);
      await db
        .update(users)
        .set({ name: `Test ${role}` })
        .where(eq(users.id, people[role].id));
    });
  }

  it("keeps the author of a logged action from being deleted", async () => {
    await expect(db.delete(users).where(eq(users.id, people.owner.id))).rejects.toThrow();
  });
});

describe("failed sign-ins", () => {
  it(`lock the address after ${maxFailures} in a row, whatever the IP`, async () => {
    const target = await createUser("sales");
    for (let i = 0; i < maxFailures; i++) {
      const response = await signIn(target.email, "wrong password, try again");
      expect(response.status, `attempt ${i + 1}`).toBe(401);
    }
    const locked = await signIn(target.email);
    expect(locked.status).toBe(429);
    expect(await locked.json()).toMatchObject({ code: "ACCOUNT_LOCKED" });

    // Once the lock runs out the right password works and clears the count.
    await db
      .update(loginThrottles)
      .set({ lockedUntil: new Date(Date.now() - 1000) })
      .where(eq(loginThrottles.email, target.email));
    expect((await signIn(target.email)).status).toBe(200);
    expect(
      await db.select().from(loginThrottles).where(eq(loginThrottles.email, target.email)),
    ).toEqual([]);
  });

  it("start counting again after a successful sign-in", async () => {
    const target = await createUser("editor");
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < maxFailures - 1; i++) {
        expect((await signIn(target.email, "wrong password, try again")).status).toBe(401);
      }
      expect((await signIn(target.email)).status, `round ${round + 1}`).toBe(200);
    }
  });

  it("are counted for unknown addresses too, so the lock reveals nothing", async () => {
    const email = `nobody-${randomUUID().slice(0, 8)}@test.kalbajarcity.com`;
    for (let i = 0; i < maxFailures; i++) await signIn(email, "anything at all here");
    expect((await signIn(email)).status).toBe(429);
  });
});

describe("password reset", () => {
  it("e-mails a link that sets a new password, signs other sessions out and is audited", async () => {
    const target = await createUser("editor");
    const request = await call("/request-password-reset", {
      body: { email: target.email, redirectTo: "/admin/sifre-berpa" },
    });
    expect(request.status).toBe(200);
    expect(mail.sent).toHaveLength(1);
    const link = mail.sent[0]?.text.match(/https?:\/\/\S+/)?.[0];
    expect(link).toContain("/api/v1/auth/reset-password/");

    const landing = await getAuth().handler(new Request(link!, { headers: { origin } }));
    const location = new URL(landing.headers.get("location") ?? "", origin);
    expect(location.pathname).toBe("/admin/sifre-berpa");
    const token = location.searchParams.get("token");
    expect(token).toBeTruthy();

    const newPassword = "a brand new passphrase";
    const reset = await call("/reset-password", { body: { newPassword, token } });
    expect(reset.status).toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.id))).toEqual([]);
    expect(await lastAudit(target.id, "user.password_reset")).toMatchObject({
      actorId: target.id,
      before: null,
      after: null,
    });
    expect((await signIn(target.email)).status).toBe(401);
    expect((await signIn(target.email, newPassword)).status).toBe(200);
  });

  it("sends nothing for an unknown address and answers the same", async () => {
    const response = await call("/request-password-reset", {
      body: { email: "nobody@test.kalbajarcity.com", redirectTo: "/admin/sifre-berpa" },
    });
    expect(response.status).toBe(200);
    expect(mail.sent).toHaveLength(0);
  });
});

describe("pnpm auth:owner", () => {
  it("creates an owner who can sign in, then resets the password and signs it out", async () => {
    const email = `first-owner-${randomUUID().slice(0, 8)}@test.kalbajarcity.com`;
    const first = await setOwner(db, { email, name: "First Owner", password });
    expect(first.created).toBe(true);
    const cookie = sessionCookie(await signIn(email));
    expect(await lastAudit(first.userId, "user.create")).toMatchObject({ actorId: null });

    const second = await setOwner(db, {
      email,
      name: "First Owner",
      password: "another passphrase",
    });
    expect(second).toEqual({ userId: first.userId, created: false });
    page.cookie = cookie;
    await expect(requireUser()).rejects.toThrow("redirect:/admin/giris");
    expect((await signIn(email)).status).toBe(401);
    expect((await signIn(email, "another passphrase")).status).toBe(200);
    expect(await lastAudit(first.userId, "user.password_set")).toMatchObject({ actorId: null });
  });

  it("refuses a short password", async () => {
    await expect(
      setOwner(db, { email: "short@test.kalbajarcity.com", name: "Short", password: "short" }),
    ).rejects.toThrow();
  });
});
