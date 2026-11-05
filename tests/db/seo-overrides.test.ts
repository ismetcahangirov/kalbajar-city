import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, seoOverrides } from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";
import type { AdminSeoOverride, SeoPage } from "@/shared/seo-overrides";

import { createUser, origin, type TestUser } from "./accounts";

// Outside Next, "use cache" is inert; revalidations are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as Array<[string, unknown]> }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string, profile: unknown) => void cache.revalidated.push([tag, profile]),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const list = await import("@/app/api/v1/admin/seo-overrides/route");
const item = await import("@/app/api/v1/admin/seo-overrides/[id]/route");
const pages = await import("@/app/api/v1/admin/seo-overrides/pages/route");
const { getSeoOverride } = await import("@/lib/public/seo");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const people = {} as Record<UserRole, TestUser>;

beforeAll(async () => {
  for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(seoOverrides);
});

function request(method: string, path: string, user: TestUser, body?: unknown) {
  const headers = new Headers({ "user-agent": "vitest", cookie: user.cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1/admin/seo-overrides${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const create = (user: TestUser, body: Record<string, unknown>) =>
  list.POST(request("POST", "", user, body));

const update = (user: TestUser, id: string, body: Record<string, unknown>) =>
  item.PUT(request("PUT", `/${id}`, user, body), { params: Promise.resolve({ id }) });

const remove = (user: TestUser, id: string) =>
  item.DELETE(request("DELETE", `/${id}`, user), { params: Promise.resolve({ id }) });

async function fieldsOf(response: Response) {
  return ((await response.json()) as { error: { fields?: Record<string, string[]> } }).error.fields;
}

describe("/api/v1/admin/seo-overrides", () => {
  it("lets roles with seo:update write, audits and revalidates settings", async () => {
    const body = { path: "/elaqe/", title: { en: "Contact the sales office" } };
    expect((await create(people.sales, body)).status).toBe(403);
    expect((await list.GET(request("GET", "", people.sales))).status).toBe(403);
    expect(cache.revalidated).toEqual([]);

    const response = await create(people.editor, body);
    expect(response.status).toBe(201);
    const saved = (await response.json()) as AdminSeoOverride;
    expect(saved).toMatchObject({
      path: "/elaqe",
      title: { az: "", en: "Contact the sales office", ru: "" },
      description: { az: "", en: "", ru: "" },
      ogMediaId: null,
      noindex: false,
    });
    expect(cache.revalidated).toEqual([["settings", { expire: 0 }]]);

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, saved.id), eq(auditLog.action, "seo_override.create")));
    expect(entry?.after).toMatchObject({
      path: "/elaqe",
      title: { az: "", en: "Contact the sales office", ru: null },
      description: null,
    });

    // An override applies only in the languages it has a value for.
    expect((await getSeoOverride("/elaqe", "en"))?.title).toBe("Contact the sales office");
    expect((await getSeoOverride("/elaqe", "az"))?.title).toBeNull();

    const listed = (await (
      await list.GET(request("GET", "", people.admin))
    ).json()) as AdminSeoOverride[];
    expect(listed.map((row) => row.path)).toContain("/elaqe");
  });

  it("keeps one override per path and refuses a missing image", async () => {
    const first = await create(people.admin, { path: "/kompleks", noindex: true });
    expect(first.status).toBe(201);
    const second = await create(people.admin, { path: "/kompleks/", title: { az: "Kompleks" } });
    expect(second.status).toBe(422);
    expect(await fieldsOf(second)).toEqual({ path: ["seo.error.taken"] });

    const image = await create(people.admin, {
      path: "/qalereya",
      ogMediaId: "00000000-0000-4000-8000-000000000000",
    });
    expect(image.status).toBe(422);
    expect(await fieldsOf(image)).toEqual({ ogMediaId: ["seo.error.image"] });

    const empty = await create(people.admin, { path: "/tikinti" });
    expect(empty.status).toBe(422);
  });

  it("updates and deletes, each audited and revalidated", async () => {
    const created = (await (
      await create(people.admin, { path: "/haqqimizda", title: { az: "Haqqımızda" } })
    ).json()) as AdminSeoOverride;
    cache.revalidated.length = 0;

    const response = await update(people.editor, created.id, {
      path: "/haqqimizda",
      title: { az: "Developer haqqında" },
      description: { ru: "О застройщике" },
    });
    expect(response.status).toBe(200);
    expect(await getSeoOverride("/haqqimizda", "ru")).toMatchObject({
      title: null,
      description: "О застройщике",
    });
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, "seo_override.update")));
    expect(entry?.before).toMatchObject({ title: { az: "Haqqımızda" }, description: null });

    expect((await remove(people.sales, created.id)).status).toBe(403);
    expect((await remove(people.editor, created.id)).status).toBe(204);
    expect((await remove(people.editor, created.id)).status).toBe(404);
    expect(await getSeoOverride("/haqqimizda", "az")).toBeNull();
    expect(cache.revalidated).toEqual([
      ["settings", { expire: 0 }],
      ["settings", { expire: 0 }],
    ]);
  });

  it("suggests the site's pages", async () => {
    const response = await pages.GET(request("GET", "/pages", people.editor));
    expect(response.status).toBe(200);
    const listed = (await response.json()) as SeoPage[];
    expect(listed).toContainEqual({ path: "/", label: "Ana səhifə", kind: "page" });
    expect(listed.map((page) => page.path)).toContain("/elaqe");
  });
});
