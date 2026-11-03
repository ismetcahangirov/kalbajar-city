import { and, eq } from "drizzle-orm";
import type { NextFetchEvent } from "next/server";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, redirects } from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";
import type { AdminRedirect } from "@/shared/redirects";

import { createUser, origin, type TestUser } from "./accounts";

vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: () => {},
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const list = await import("@/app/api/v1/admin/redirects/route");
const item = await import("@/app/api/v1/admin/redirects/[id]/route");
const serve = await import("@/lib/redirects/serve");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const people = {} as Record<UserRole, TestUser>;

beforeAll(async () => {
  for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(redirects);
});

function request(method: string, path: string, user: TestUser, body?: unknown) {
  const headers = new Headers({ "user-agent": "vitest", cookie: user.cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1/admin/redirects${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const create = (user: TestUser, body: Record<string, unknown>) =>
  list.POST(request("POST", "", user, { statusCode: 301, ...body }));

const update = (user: TestUser, id: string, body: Record<string, unknown>) =>
  item.PUT(request("PUT", `/${id}`, user, { statusCode: 301, ...body }), {
    params: Promise.resolve({ id }),
  });

async function errorOf(response: Response) {
  return ((await response.json()) as { error: Record<string, unknown> }).error;
}

describe("/api/v1/admin/redirects", () => {
  it("lets roles with seo:update write and seo:read list", async () => {
    expect((await create(people.sales, { fromPath: "/r1", toPath: "/elaqe" })).status).toBe(403);
    expect((await list.GET(request("GET", "", people.sales))).status).toBe(403);

    const response = await create(people.editor, { fromPath: "/r1/", toPath: "/elaqe" });
    expect(response.status).toBe(201);
    const saved = (await response.json()) as AdminRedirect;
    expect(saved).toMatchObject({ fromPath: "/r1", toPath: "/elaqe", statusCode: 301, hits: 0 });

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, saved.id), eq(auditLog.action, "redirect.create")));
    expect(entry?.after).toEqual({ fromPath: "/r1", toPath: "/elaqe", statusCode: 301 });

    const listed = (await (
      await list.GET(request("GET", "", people.admin))
    ).json()) as AdminRedirect[];
    expect(listed.map((row) => row.fromPath)).toContain("/r1");
  });

  it("refuses a taken source, a legacy source and a redirect to itself", async () => {
    await create(people.admin, { fromPath: "/r2", toPath: "/elaqe" });
    const taken = await create(people.admin, { fromPath: "/r2", toPath: "/kompleks" });
    expect(taken.status).toBe(422);
    expect((await errorOf(taken)).fields).toEqual({ fromPath: ["redirects.error.taken"] });

    const legacy = await create(people.admin, { fromPath: "/laq", toPath: "/kompleks" });
    expect((await errorOf(legacy)).fields).toEqual({ fromPath: ["redirects.error.legacy"] });

    const self = await create(people.admin, { fromPath: "/r3", toPath: `${origin}/r3/` });
    expect((await errorOf(self)).fields).toEqual({ toPath: ["redirects.error.self"] });
  });

  it("refuses a loop on save, through other redirects and through legacy ones", async () => {
    await create(people.admin, { fromPath: "/l1", toPath: "/l2" });
    const second = (await (
      await create(people.admin, { fromPath: "/l2", toPath: "/l3", resolveChains: true })
    ).json()) as AdminRedirect;
    // The chain was resolved: /l1 now points straight at /l3.
    const [l1] = await db.select().from(redirects).where(eq(redirects.fromPath, "/l1"));
    expect(l1?.toPath).toBe("/l3");

    const loop = await create(people.admin, { fromPath: "/l3", toPath: "/l1" });
    expect(loop.status).toBe(422);
    const error = await errorOf(loop);
    expect(error.code).toBe("REDIRECT_LOOP");
    expect(error.cycle).toEqual(["/l3", "/l1", "/l3"]);

    const viaLegacy = await create(people.admin, { fromPath: "/elaqe", toPath: "/laq" });
    expect((await errorOf(viaLegacy)).code).toBe("REDIRECT_LOOP");

    // An edit is checked the same way.
    const edited = await update(people.admin, second.id, { fromPath: "/l3", toPath: "/l1" });
    expect((await errorOf(edited)).code).toBe("REDIRECT_LOOP");
    expect(await db.select().from(redirects).where(eq(redirects.fromPath, "/l3"))).toEqual([]);
  });

  it("reports a chain and resolves it only when asked", async () => {
    // A chain saved before the check existed, or by hand.
    await db.insert(redirects).values([
      { fromPath: "/c1", toPath: "/c2" },
      { fromPath: "/c2", toPath: "/menziller" },
    ]);

    const chain = await create(people.admin, { fromPath: "/c0", toPath: "/c1" });
    expect(chain.status).toBe(409);
    const error = await errorOf(chain);
    expect(error).toMatchObject({
      code: "REDIRECT_CHAIN",
      hops: ["/c0", "/c1", "/c2", "/menziller"],
      final: "/menziller",
      incoming: [],
    });
    expect(await db.select().from(redirects).where(eq(redirects.fromPath, "/c0"))).toEqual([]);

    const resolved = await create(people.admin, {
      fromPath: "/c0",
      toPath: "/c1",
      resolveChains: true,
    });
    expect(((await resolved.json()) as AdminRedirect).toPath).toBe("/menziller");
  });

  it("deletes with an audit entry", async () => {
    const saved = (await (
      await create(people.admin, { fromPath: "/d1", toPath: "/elaqe" })
    ).json()) as AdminRedirect;
    const response = await item.DELETE(request("DELETE", `/${saved.id}`, people.editor), {
      params: Promise.resolve({ id: saved.id }),
    });
    expect(response.status).toBe(204);
    const entries = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, saved.id), eq(auditLog.action, "redirect.delete")));
    expect(entries).toHaveLength(1);
  });
});

describe("serving redirects from the proxy", () => {
  function event() {
    const pending: Promise<unknown>[] = [];
    const value = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
    return { event: value as unknown as NextFetchEvent, settle: () => Promise.all(pending) };
  }

  it("serves a redirect saved in the console and counts its hits", async () => {
    const saved = (await (
      await create(people.admin, { fromPath: "/s1", toPath: "/elaqe", statusCode: 302 })
    ).json()) as AdminRedirect;

    const first = event();
    const response = await serve.redirectFor(new URL(`${origin}/s1?utm_source=ig`), first.event);
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(`${origin}/elaqe?utm_source=ig`);
    await first.settle();

    const [row] = await db.select().from(redirects).where(eq(redirects.id, saved.id));
    expect(row?.hits).toBe(1);
    expect(row?.lastHitAt).toBeInstanceOf(Date);
    expect(row?.updatedAt.toISOString()).toBe(saved.updatedAt);
    expect(await serve.redirectFor(new URL(`${origin}/elaqe`), event().event)).toBeNull();
  });

  it("picks up a new redirect once its copy is older than the refresh interval", async () => {
    const warm = event();
    await serve.redirectFor(new URL(`${origin}/s2`), warm.event);
    await warm.settle();
    await create(people.admin, { fromPath: "/s2", toPath: "/kompleks" });

    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + serve.refreshAfterMs + 1);
    try {
      // The request that notices the stale copy is answered from it and reloads it.
      const stale = event();
      expect(await serve.redirectFor(new URL(`${origin}/s2`), stale.event)).toBeNull();
      await stale.settle();
      const fresh = await serve.redirectFor(new URL(`${origin}/s2`), event().event);
      expect(fresh?.status).toBe(301);
      expect(fresh?.headers.get("location")).toBe(`${origin}/kompleks`);
    } finally {
      clock.mockRestore();
    }
  });
});
