import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { clientIp, diff } from "@/lib/audit";
import { safeAdminRedirect } from "@/lib/auth/paths";
import { can, canManageUser, type Permission, type UserRole } from "@/lib/auth/permissions";
import { guardAdmin } from "@/lib/auth/guard";
import { isMessageKey } from "@/lib/admin/messages";
import { roleValues } from "@/shared/users";
import { userRoles } from "@/db/schema/auth";

// The matrix from #9, one row per role: what it must be able to do and what
// it must not.
const matrix: Record<UserRole, { allowed: Permission[]; forbidden: Permission[] }> = {
  owner: {
    allowed: [
      { user: ["create", "set-role", "ban"] },
      { settings: ["update"] },
      { leads: ["read", "update", "assign", "export", "delete"] },
    ],
    forbidden: [{ user: ["impersonate"] }],
  },
  admin: {
    allowed: [
      { user: ["create", "set-role", "ban"] },
      { settings: ["update"] },
      { audit: ["read"] },
      { leads: ["read", "update", "assign", "export", "delete"] },
    ],
    forbidden: [{ user: ["impersonate"] }],
  },
  editor: {
    allowed: [{ content: ["publish"] }, { media: ["upload", "delete"] }, { seo: ["update"] }],
    forbidden: [
      { leads: ["read"] },
      { inventory: ["read"] },
      { settings: ["update"] },
      { user: ["list"] },
    ],
  },
  sales: {
    allowed: [
      { leads: ["read", "update"] },
      { inventory: ["read"] },
      { apartmentStatus: ["update"] },
    ],
    forbidden: [
      // Sales works its own and unassigned leads; the export is the owner's and admins'.
      { leads: ["assign"] },
      { leads: ["export"] },
      { leads: ["delete"] },
      { settings: ["read"] },
      { inventory: ["update"] },
      { content: ["update"] },
      { media: ["upload"] },
      { user: ["list"] },
    ],
  },
};

describe("permission matrix", () => {
  for (const [role, { allowed, forbidden }] of Object.entries(matrix) as [
    UserRole,
    (typeof matrix)[UserRole],
  ][]) {
    it.each(allowed.map((p) => [JSON.stringify(p), p] as const))(
      `${role} may %s`,
      (_, permission) => {
        expect(can(role, permission)).toBe(true);
      },
    );
    it.each(forbidden.map((p) => [JSON.stringify(p), p] as const))(
      `${role} may not %s`,
      (_, permission) => {
        expect(can(role, permission)).toBe(false);
      },
    );
  }
});

describe("canManageUser", () => {
  const owner = { id: "o", role: "owner" as const };
  const otherOwner = { id: "o2", role: "owner" as const };
  const admin = { id: "a", role: "admin" as const };
  const editor = { id: "e", role: "editor" as const };
  const sales = { id: "s", role: "sales" as const };

  it("lets an admin manage every role but the owner", () => {
    expect(canManageUser(admin, editor)).toBe(true);
    expect(canManageUser(admin, sales, "editor")).toBe(true);
    expect(canManageUser(admin, owner)).toBe(false);
    expect(canManageUser(admin, editor, "owner")).toBe(false);
  });

  it("lets an owner manage another owner and grant the owner role", () => {
    expect(canManageUser(owner, otherOwner, "admin")).toBe(true);
    expect(canManageUser(owner, admin, "owner")).toBe(true);
  });

  it("never lets anyone change their own account this way", () => {
    expect(canManageUser(owner, owner, "editor")).toBe(false);
    expect(canManageUser(admin, admin)).toBe(false);
  });

  it("keeps editors and sales out of user management", () => {
    expect(canManageUser(editor, sales)).toBe(false);
    expect(canManageUser(sales, editor)).toBe(false);
  });
});

describe("safeAdminRedirect", () => {
  it.each([
    [undefined, "/admin"],
    ["/admin/menziller?status=sold", "/admin/menziller?status=sold"],
    ["/menziller", "/admin"],
    ["https://evil.example/admin", "/admin"],
    ["//evil.example/admin", "/admin"],
    ["/admin\\@evil.example", "/admin"],
    ["/administrator", "/admin"],
    ["/admin/giris", "/admin"],
    ["/admin/sifre-berpa?token=x", "/admin"],
  ])("%s → %s", (input, expected) => {
    expect(safeAdminRedirect(input)).toBe(expected);
  });
});

describe("audit diff", () => {
  it("keeps only the changed fields and never a secret", () => {
    const before = { name: "A", role: "editor", password: "x", updatedAt: new Date(1) };
    const after = { name: "B", role: "editor", password: "y", updatedAt: new Date(2) };
    expect(diff(before, after)).toEqual({ before: { name: "A" }, after: { name: "B" } });
  });

  it("keeps the whole row on create and remove", () => {
    const row = { id: "1", banExpires: new Date("2026-11-02T00:00:00Z"), token: "t" };
    const plain = { id: "1", banExpires: "2026-11-02T00:00:00.000Z" };
    expect(diff(null, row)).toEqual({ before: null, after: plain });
    expect(diff(row, null)).toEqual({ before: plain, after: null });
  });

  it("reads the client IP from the proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("proxy guard", () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(new URL(path, "http://localhost:3010"), {
      headers: cookie ? { cookie } : {},
    });
  const session = "better-auth.session_token=abc.def";

  it("sends a signed-out visitor to the sign-in page, keeping the target", () => {
    const response = guardAdmin(request("/admin/muracietler?status=new"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3010/admin/giris?next=%2Fadmin%2Fmuracietler%3Fstatus%3Dnew",
    );
    expect(guardAdmin(request("/admin")).headers.get("location")).toBe(
      "http://localhost:3010/admin/giris",
    );
  });

  it("lets anyone open the sign-in and password pages", () => {
    expect(guardAdmin(request("/admin/giris")).headers.get("x-middleware-next")).toBe("1");
    expect(guardAdmin(request("/admin/sifre-berpa?token=x")).headers.get("x-middleware-next")).toBe(
      "1",
    );
  });

  it("answers 401 in the shared error shape for the admin API", async () => {
    const response = guardAdmin(request("/api/v1/admin/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
  });

  it("passes a request with a session cookie on to the page or handler", () => {
    expect(guardAdmin(request("/admin", session)).headers.get("x-middleware-next")).toBe("1");
    expect(guardAdmin(request("/api/v1/admin/me", session)).headers.get("x-middleware-next")).toBe(
      "1",
    );
  });
});

describe("the invitation page", () => {
  it("is open to signed-out visitors, who have only the e-mailed link", () => {
    const request = new NextRequest("http://localhost:3010/admin/devet?token=abc");
    expect(guardAdmin(request).headers.get("location")).toBeNull();
  });
});

describe("roleValues", () => {
  it("is the database enum, which the shared schemas cannot import into forms", () => {
    expect([...roleValues]).toEqual([...userRoles]);
  });
});

describe("the audit log's labels", () => {
  it.each([
    "user.create",
    "user.set_role",
    "user.deactivate",
    "user.reactivate",
    "invitation.create",
    "invitation.resend",
    "invitation.revoke",
    "invitation.accept",
  ])("name %s, which user management records", (action) => {
    expect(isMessageKey(`audit.${action}`)).toBe(true);
  });
});
