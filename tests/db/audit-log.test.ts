import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { UserRole } from "@/lib/auth/permissions";
import type { Page } from "@/shared/api";
import { auditRedacted, type AdminAuditEntry } from "@/shared/audit";

import { createUser, origin, type TestUser } from "./accounts";

vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const { GET } = await import("@/app/api/v1/admin/audit/route");
const { auditFilterOptions } = await import("@/lib/admin/audit-log");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const people = {} as Record<UserRole, TestUser>;
const entityPrefix = `t_audit_${randomUUID().slice(0, 8).replace(/-/g, "")}`;
const entity = (name: string) => `${entityPrefix}_${name}`;

beforeAll(async () => {
  for (const role of ["owner", "admin", "editor", "sales"] as const) {
    people[role] = await createUser(role);
  }
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(auditLog).where(like(auditLog.entityType, `${entityPrefix}%`));
});

function get(user: TestUser | null, params: Record<string, string> = {}) {
  const search = new URLSearchParams(params);
  return GET(
    new Request(`${origin}/api/v1/admin/audit?${search}`, {
      headers: user ? { cookie: user.cookie } : {},
    }),
  );
}

async function list(params: Record<string, string>): Promise<Page<AdminAuditEntry>> {
  const response = await get(people.owner, params);
  expect(response.status).toBe(200);
  return (await response.json()) as Page<AdminAuditEntry>;
}

function row(values: Partial<typeof auditLog.$inferInsert> & { entityType: string }) {
  return { action: `${values.entityType}.update`, ...values };
}

describe("GET /api/v1/admin/audit: who may read", () => {
  it("answers 401 without a session", async () => {
    expect((await get(null)).status).toBe(401);
  });

  it("is for those with audit:read: owner and admin, not editor or sales", async () => {
    expect((await get(people.owner)).status).toBe(200);
    expect((await get(people.admin)).status).toBe(200);
    expect((await get(people.editor)).status).toBe(403);
    expect((await get(people.sales)).status).toBe(403);
  });

  it("refuses an invalid query with the shared error shape", async () => {
    const response = await get(people.owner, { from: "not-a-day" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_QUERY");
  });
});

describe("what the log returns", () => {
  it("returns what audit() stored for an update, a create, a removal and a bare fact", async () => {
    const entityType = entity("shape");
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "vitest-ua" });
    const actorId = people.admin.id;
    const base = { actorId, entityType, entityId: "e1", headers };
    await audit(db, {
      ...base,
      action: `${entityType}.update`,
      before: { price: 1, name: "same", updatedAt: new Date(1) },
      after: { price: 2, name: "same", updatedAt: new Date(2) },
    });
    await audit(db, {
      ...base,
      action: `${entityType}.create`,
      after: { price: 2, at: new Date(0) },
    });
    await audit(db, { ...base, action: `${entityType}.delete`, before: { price: 2 }, after: null });
    await audit(db, { ...base, action: `${entityType}.fact` });

    const { items, total } = await list({ entityType, sort: "createdAt" });
    expect(total).toBe(4);
    const byAction = new Map(items.map((item) => [item.action.split(".")[1], item]));
    expect(byAction.get("update")).toMatchObject({
      before: { price: 1 },
      after: { price: 2 },
      entityId: "e1",
      ip: "203.0.113.9",
      userAgent: "vitest-ua",
      actor: { id: actorId, name: expect.any(String) as string },
    });
    expect(byAction.get("update")!.before).not.toHaveProperty("name");
    expect(byAction.get("create")).toMatchObject({
      before: null,
      after: { price: 2, at: "1970-01-01T00:00:00.000Z" },
    });
    expect(byAction.get("delete")).toMatchObject({ before: { price: 2 }, after: null });
    expect(byAction.get("fact")).toMatchObject({ before: null, after: null });
  });

  it("redacts secrets on the server, wherever they are in a stored row", async () => {
    const entityType = entity("secret");
    const hash = await hashPassword("a passphrase that is long");
    const secrets = {
      hash,
      token: "tok-AAAA1111",
      nested: "nested-BBBB2222",
      inText: "text-CCCC3333",
      inId: "id-DDDD4444",
      inAgent: "agent-EEEE5555",
    };
    // As an older write or a nested value would have left it: straight in the
    // table, past the names audit() drops.
    await db.insert(auditLog).values(
      row({
        entityType,
        actorId: people.owner.id,
        entityId: `reset-password:${secrets.inId}`,
        before: {
          name: "Old name",
          passwordHash: secrets.hash,
          sessionToken: secrets.token,
          account: { password: secrets.nested, providerId: "credential" },
          note: hash,
        },
        after: {
          name: "New name",
          passwordHash: `${secrets.hash}x`,
          link: `https://x.test/?token=${secrets.inText}&a=1`,
        },
        userAgent: `curl Bearer ${secrets.inAgent}abcdefgh`,
      }),
    );

    const response = await get(people.owner, { entityType });
    const text = await response.text();
    for (const [name, secret] of Object.entries(secrets)) {
      expect(text.includes(secret), `the response holds ${name}`).toBe(false);
    }

    const { items } = JSON.parse(text) as Page<AdminAuditEntry>;
    const [entry] = items;
    expect(entry!.before).toEqual({
      name: "Old name",
      passwordHash: auditRedacted,
      sessionToken: auditRedacted,
      account: { password: auditRedacted, providerId: "credential" },
      note: auditRedacted,
    });
    expect(entry!.after).toEqual({
      name: "New name",
      passwordHash: auditRedacted,
      link: `https://x.test/?token=${auditRedacted}&a=1`,
    });
  });

  it("keeps what audit() drops out, and shows the rest of the row", async () => {
    const entityType = entity("user_row");
    await audit(db, {
      actorId: null,
      action: `${entityType}.create`,
      entityType,
      after: { id: "u", email: "a@b.test", password: "plain-FFFF6666", token: "tok-GGGG7777" },
    });
    const text = await (await get(people.owner, { entityType })).text();
    expect(text).toContain("a@b.test");
    expect(text).not.toContain("plain-FFFF6666");
    expect(text).not.toContain("tok-GGGG7777");
  });

  it("names the system when no user acted", async () => {
    const entityType = entity("system");
    await db.insert(auditLog).values(row({ entityType, actorId: null }));
    const { items } = await list({ entityType });
    expect(items[0]!.actor).toBeNull();
  });
});

describe("filters and pagination", () => {
  it("filters by user, and by the system", async () => {
    const entityType = entity("actor");
    await db
      .insert(auditLog)
      .values([
        row({ entityType, actorId: people.owner.id, entityId: "o" }),
        row({ entityType, actorId: people.admin.id, entityId: "a" }),
        row({ entityType, actorId: null, entityId: "s" }),
      ]);
    const ids = async (params: Record<string, string>) =>
      (await list({ entityType, ...params })).items.map((item) => item.entityId).sort();

    expect(await ids({ actor: people.owner.id })).toEqual(["o"]);
    expect(await ids({ actor: "system" })).toEqual(["s"]);
    expect(await ids({ actor: `system,${people.admin.id}` })).toEqual(["a", "s"]);
    expect(await ids({})).toEqual(["a", "o", "s"]);
  });

  it("filters by entity type and by entity id", async () => {
    const first = entity("type_a");
    const second = entity("type_b");
    await db
      .insert(auditLog)
      .values([
        row({ entityType: first, entityId: "x" }),
        row({ entityType: first, entityId: "y" }),
        row({ entityType: second, entityId: "x" }),
      ]);
    expect((await list({ entityType: first })).total).toBe(2);
    expect((await list({ entityType: `${first},${second}` })).total).toBe(3);
    expect((await list({ entityType: first, entityId: "x" })).total).toBe(1);
    expect((await list({ entityType: first, entityId: "absent" })).total).toBe(0);
  });

  it("reads days in Baku time, both ends included", async () => {
    const entityType = entity("days");
    await db.insert(auditLog).values([
      // 23:59 on 2 November in Baku.
      row({ entityType, entityId: "nov2", createdAt: new Date("2026-11-02T19:59:00Z") }),
      // 00:00 on 3 November in Baku, still 2 November in UTC.
      row({ entityType, entityId: "nov3", createdAt: new Date("2026-11-02T20:00:00Z") }),
      // 23:59 on 3 November in Baku.
      row({ entityType, entityId: "nov3late", createdAt: new Date("2026-11-03T19:59:00Z") }),
      // 00:00 on 4 November in Baku.
      row({ entityType, entityId: "nov4", createdAt: new Date("2026-11-03T20:00:00Z") }),
    ]);
    const ids = async (params: Record<string, string>) =>
      (await list({ entityType, ...params })).items.map((item) => item.entityId);

    expect(await ids({ from: "2026-11-03", to: "2026-11-03" })).toEqual(["nov3late", "nov3"]);
    expect(await ids({ to: "2026-11-02" })).toEqual(["nov2"]);
    expect(await ids({ from: "2026-11-04" })).toEqual(["nov4"]);
  });

  it("pages newest first, and settles a shared timestamp by id without repeats", async () => {
    const entityType = entity("pages");
    const createdAt = new Date("2026-11-02T10:00:00Z");
    await db
      .insert(auditLog)
      .values(
        Array.from({ length: 5 }, (_, index) =>
          row({ entityType, entityId: String(index), createdAt }),
        ),
      );
    const first = await list({ entityType, pageSize: "2", page: "1" });
    const second = await list({ entityType, pageSize: "2", page: "2" });
    const third = await list({ entityType, pageSize: "2", page: "3" });
    expect(first).toMatchObject({ total: 5, pageCount: 3, page: 1, pageSize: 2 });
    const seen = [...first.items, ...second.items, ...third.items].map((item) => item.entityId);
    expect(seen).toEqual(["4", "3", "2", "1", "0"]);

    const oldest = await list({ entityType, pageSize: "1", sort: "createdAt" });
    expect(oldest.items[0]!.entityId).toBe("0");
  });

  it("offers every account and the entity types the log holds", async () => {
    const entityType = entity("options");
    await db.insert(auditLog).values(row({ entityType }));
    const options = await auditFilterOptions(db);
    expect(options.entityTypes).toContain(entityType);
    expect(options.actors.map((actor) => actor.id)).toEqual(
      expect.arrayContaining([people.owner.id, people.sales.id]),
    );
  });
});
