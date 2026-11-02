import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import {
  apartments,
  auditLog,
  blocks,
  buildings,
  floors,
  leadEvents,
  leads,
  layoutTypes,
  settings,
} from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";

import { createUser, origin, type TestUser } from "./accounts";

// Outside Next, "use cache" is inert; the cache calls are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as Array<[string, unknown]> }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string, profile: unknown) => void cache.revalidated.push([tag, profile]),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
// The sales e-mail runs after the answer; tests/db/leads.test.ts covers it.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

const publicList = await import("@/app/api/v1/apartments/route");
const publicDetail = await import("@/app/api/v1/apartments/[slug]/route");
const layoutRoute = await import("@/app/api/v1/layout-types/route");
const leadRoute = await import("@/app/api/v1/leads/route");
const adminList = await import("@/app/api/v1/admin/apartments/route");
const adminItem = await import("@/app/api/v1/admin/apartments/[id]/route");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

/** Unique per run, so these fixtures never meet seeded or other tests' rows. */
const tag = randomUUID().slice(0, 6);
const blockCode = `T${tag.slice(0, 4)}`.toUpperCase();
const slugOf = (name: string) => `t-${tag}-${name}`;

const ids = { building: "", block: "", floors: [] as string[], layouts: [] as string[] };
const apartmentIds: Record<string, string> = {};

let client = 0;

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; contentType?: string } = {},
) {
  // A new client address per request, so the lead rate limit never decides a test.
  const headers = new Headers({
    "user-agent": "vitest",
    "x-forwarded-for": `192.0.2.${(client++ % 250) + 1}`,
  });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", init.contentType ?? "application/json");
  return new Request(`${origin}/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body),
  });
}

const context = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

beforeAll(async () => {
  const [building] = await db
    .insert(buildings)
    .values({ slug: slugOf("bina"), name: { az: "Test bina" } })
    .returning();
  const [block] = await db
    .insert(blocks)
    .values({
      buildingId: building!.id,
      slug: slugOf("blok"),
      code: blockCode,
      name: { az: "Test blok", en: "Test block" },
    })
    .returning();
  const floorRows = await db
    .insert(floors)
    .values([1, 2, 3].map((number) => ({ blockId: block!.id, number })))
    .returning();
  const layoutRows = await db
    .insert(layoutTypes)
    .values([
      {
        slug: slugOf("2-otaq"),
        code: `${tag}-2`,
        rooms: 2,
        areaTotal: "68.40",
        roomAreas: [{ kind: "living", area: "20.00" }],
      },
      { slug: slugOf("3-otaq"), code: `${tag}-3`, rooms: 3, areaTotal: "96.10" },
    ])
    .returning();
  ids.building = building!.id;
  ids.block = block!.id;
  ids.floors = floorRows.map((row) => row.id);
  ids.layouts = layoutRows.map((row) => row.id);

  const [two, three] = layoutRows;
  const [first, second, third] = floorRows;
  const rows = await db
    .insert(apartments)
    .values(
      [
        // name, floor, layout, status, area, price
        ["101", first, two, "available", "68.40", 15_000_000],
        ["102", first, three, "reserved", "96.10", 21_000_000],
        ["201", second, two, "sold", "68.90", null],
        ["202", second, three, "not_for_sale", "96.10", null],
        ["301", third, two, "available", "68.40", 15_500_000],
        ["1001", third, three, "available", "96.20", 22_000_000],
      ].map(([number, floor, layout, status, areaTotal, priceMinor]) => ({
        slug: slugOf(`m-${number}`),
        number: number as string,
        floorId: (floor as { id: string }).id,
        layoutTypeId: (layout as { id: string }).id,
        status: status as "available",
        areaTotal: areaTotal as string,
        priceMinor: priceMinor as number | null,
      })),
    )
    .returning();
  for (const row of rows) apartmentIds[row.number] = row.id;
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(leads).where(eq(leads.sourcePath, `/t-${tag}`));
  await db.delete(apartments).where(inArray(apartments.id, Object.values(apartmentIds)));
  await db.delete(layoutTypes).where(inArray(layoutTypes.id, ids.layouts));
  await db.delete(floors).where(inArray(floors.id, ids.floors));
  await db.delete(blocks).where(eq(blocks.id, ids.block));
  await db.delete(buildings).where(eq(buildings.id, ids.building));
  await db.delete(settings).where(eq(settings.key, "prices"));
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown> & {
    items?: Array<Record<string, unknown>>;
    error?: { code: string; message: string; fields?: Record<string, string[]> };
  };
}

describe("GET /api/v1/apartments", () => {
  it("lists the public statuses of a block in natural order, never not_for_sale", async () => {
    const response = await publicList.GET(request(`/apartments?block=${blockCode}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await json(response);
    expect(body.items?.map((item) => item.number)).toEqual(["101", "102", "201", "301", "1001"]);
    expect(body).toMatchObject({ page: 1, pageSize: 24, total: 5, pageCount: 1 });
    expect(body.items?.[0]).toMatchObject({
      slug: slugOf("m-101"),
      status: "available",
      rooms: 2,
      areaTotal: "68.40",
      floor: 1,
      block: { code: blockCode, name: { value: "Test blok", locale: "az", fallback: false } },
      layout: { slug: slugOf("2-otaq") },
      price: null,
    });
  });

  it("filters by rooms, status, area and floor, from repeated or comma-separated keys", async () => {
    const numbers = async (query: string) =>
      (
        await json(await publicList.GET(request(`/apartments?block=${blockCode}&${query}`)))
      ).items?.map((item) => item.number);
    expect(await numbers("rooms=3")).toEqual(["102", "1001"]);
    expect(await numbers("status=available&status=sold")).toEqual(["101", "201", "301", "1001"]);
    expect(await numbers("status=available,reserved&rooms=2")).toEqual(["101", "301"]);
    expect(await numbers("areaMin=68.5&areaMax=97")).toEqual(["102", "201", "1001"]);
    expect(await numbers("floorMin=2&floorMax=2")).toEqual(["201"]);
    expect(await numbers("status=not_for_sale")).toBeUndefined();
  });

  it("sorts and paginates", async () => {
    const body = await json(
      await publicList.GET(request(`/apartments?block=${blockCode}&sort=-area&pageSize=2&page=2`)),
    );
    expect(body).toMatchObject({ page: 2, pageSize: 2, total: 5, pageCount: 3 });
    // -area: 96.20, 96.10, 68.90, 68.40, 68.40 (ties in natural order).
    expect(body.items?.map((item) => item.number)).toEqual(["201", "101"]);
  });

  it("answers an invalid query with 400 and the fields", async () => {
    const response = await publicList.GET(
      request("/apartments?rooms=two&pageSize=500&status=not_for_sale"),
    );
    expect(response.status).toBe(400);
    const body = await json(response);
    expect(body.error?.code).toBe("INVALID_QUERY");
    expect(Object.keys(body.error?.fields ?? {}).sort()).toEqual(
      ["pageSize", "rooms.0", "status.0"].sort(),
    );
  });

  it("shows prices only once the owner makes them public", async () => {
    const price = async () =>
      (await json(await publicList.GET(request(`/apartments?block=${blockCode}&rooms=2`))))
        .items?.[0]?.price;
    expect(await price()).toBeNull();
    await db.insert(settings).values({ key: "prices", value: { visible: true } });
    expect(await price()).toEqual({ amount: "15000000", currency: "AZN" });
  });
});

describe("GET /api/v1/apartments/:slug", () => {
  it("answers the apartment with its building, layout breakdown and translation fallback", async () => {
    const slug = slugOf("m-101");
    const response = await publicDetail.GET(
      request(`/apartments/${slug}?locale=ru`),
      context({ slug }),
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      slug,
      building: {
        slug: slugOf("bina"),
        name: { value: "Test bina", locale: "az", fallback: true },
      },
      roomAreas: [{ kind: "living", area: "20.00" }],
      description: null,
    });
  });

  it("answers 404 for an apartment that is not for sale, unknown or malformed", async () => {
    for (const slug of [slugOf("m-202"), slugOf("nope"), "Not A Slug"]) {
      const response = await publicDetail.GET(request(`/apartments/x`), context({ slug }));
      expect(response.status, slug).toBe(404);
      expect((await json(response)).error?.code).toBe("NOT_FOUND");
    }
  });
});

describe("GET /api/v1/layout-types", () => {
  it("counts the available apartments of each layout", async () => {
    const body = (await (await layoutRoute.GET(request("/layout-types"))).json()) as Array<{
      slug: string;
      available: number;
    }>;
    const mine = body.filter((layout) => layout.slug.startsWith(`t-${tag}`));
    expect(mine).toEqual([
      expect.objectContaining({ slug: slugOf("2-otaq"), available: 2 }),
      expect.objectContaining({ slug: slugOf("3-otaq"), available: 1 }),
    ]);
  });
});

describe("POST /api/v1/leads", () => {
  const lead = {
    type: "inquiry",
    name: "Aysel Məmmədova",
    phone: "+994501234567",
    email: "",
    locale: "en",
    sourcePath: `/t-${tag}`,
    apartment: slugOf("m-101"),
    utm: { source: "instagram", medium: "" },
    consent: true,
    startedAt: Date.now() - 20_000,
    sentAt: Date.now(),
  };

  it("stores the lead with its apartment, context and a created event", async () => {
    const response = await leadRoute.POST(request("/leads", { body: lead }));
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };

    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(row).toMatchObject({
      type: "inquiry",
      status: "new",
      email: null,
      apartmentId: apartmentIds["101"],
      locale: "en",
      utm: { source: "instagram" },
    });
    const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, id));
    expect(events.map((event) => event.type)).toEqual(["created"]);
  });

  it("answers an invalid body with 422 and every invalid field, a viewing's date included", async () => {
    const response = await leadRoute.POST(
      request("/leads", {
        body: { ...lead, type: "viewing", phone: "12345", locale: "de", sourcePath: "x" },
      }),
    );
    expect(response.status).toBe(422);
    const body = await json(response);
    expect(body.error).toMatchObject({ code: "VALIDATION_FAILED", message: expect.any(String) });
    expect(Object.keys(body.error?.fields ?? {}).sort()).toEqual(
      ["locale", "phone", "preferredAt", "sourcePath"].sort(),
    );
  });

  it("answers an unknown apartment as a field error and stores nothing", async () => {
    const before = await db.select().from(leads).where(eq(leads.sourcePath, lead.sourcePath));
    const response = await leadRoute.POST(
      request("/leads", { body: { ...lead, apartment: slugOf("nope") } }),
    );
    expect(response.status).toBe(422);
    expect((await json(response)).error?.fields).toEqual({ apartment: ["Unknown apartment"] });
    const after = await db.select().from(leads).where(eq(leads.sourcePath, lead.sourcePath));
    expect(after.length).toBe(before.length);
  });

  it("refuses bodies that are not JSON", async () => {
    const form = await leadRoute.POST(
      request("/leads", { body: "name=x", contentType: "application/x-www-form-urlencoded" }),
    );
    expect(form.status).toBe(415);
    const broken = await leadRoute.POST(request("/leads", { body: "{not json" }));
    expect(broken.status).toBe(400);
    expect((await json(broken)).error?.code).toBe("MALFORMED_JSON");
  });
});

describe("/api/v1/admin/apartments", () => {
  const people = {} as Record<UserRole, TestUser>;

  beforeAll(async () => {
    for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
  });

  const patch = (id: string, role: UserRole, body: unknown) =>
    adminItem.PATCH(
      request(`/admin/apartments/${id}`, { method: "PATCH", body, cookie: people[role].cookie }),
      context({ id }),
    );

  it("lists every status, filtered, for roles that may read the inventory", async () => {
    const response = await adminList.GET(
      request(`/admin/apartments?block=${blockCode}&status=not_for_sale,sold`, {
        cookie: people.sales.cookie,
      }),
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.items?.map((item) => [item.number, item.status])).toEqual([
      ["201", "sold"],
      ["202", "not_for_sale"],
    ]);
    expect(body.items?.[0]).toMatchObject({ block: blockCode, layout: { rooms: 2 } });

    const editor = await adminList.GET(
      request("/admin/apartments", { cookie: people.editor.cookie }),
    );
    expect(editor.status).toBe(403);
  });

  it("lets sales change the status: audited, revalidated, public on the next request", async () => {
    const id = apartmentIds["301"]!;
    const response = await patch(id, "sales", { status: "reserved" });
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ id, status: "reserved", number: "301" });

    expect(cache.revalidated).toEqual([["inventory", { expire: 0 }]]);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, "apartment.update")))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    expect(entry).toMatchObject({
      actorId: people.sales.id,
      before: { status: "available" },
      after: { status: "reserved" },
      userAgent: "vitest",
    });

    const slug = slugOf("m-301");
    const publicView = await publicDetail.GET(request(`/apartments/${slug}`), context({ slug }));
    expect((await json(publicView)).status).toBe("reserved");
  });

  it("keeps prices from sales and lets an admin set them as strings of minor units", async () => {
    const id = apartmentIds["101"]!;
    const denied = await patch(id, "sales", { priceMinor: "1" });
    expect(denied.status).toBe(403);
    expect(cache.revalidated).toEqual([]);

    const response = await patch(id, "admin", { priceMinor: "15250000" });
    expect(response.status).toBe(200);
    expect((await json(response)).priceMinor).toBe("15250000");
    const [row] = await db.select().from(apartments).where(eq(apartments.id, id));
    expect(row?.priceMinor).toBe(15_250_000);

    const cleared = await patch(id, "admin", { priceMinor: null });
    expect((await json(cleared)).priceMinor).toBeNull();
  });

  it("answers invalid bodies with 422 and unknown apartments with 404", async () => {
    const id = apartmentIds["101"]!;
    const invalid = await patch(id, "admin", { status: "gone", priceMinor: 12.5, area: "1" });
    expect(invalid.status).toBe(422);
    expect(Object.keys((await json(invalid)).error?.fields ?? {}).sort()).toEqual(
      ["priceMinor", "root", "status"].sort(),
    );

    const empty = await patch(id, "admin", {});
    expect(empty.status).toBe(422);
    expect((await json(empty)).error?.fields).toEqual({ root: ["Change at least one field"] });

    const missing = await patch(randomUUID(), "admin", { status: "sold" });
    expect(missing.status).toBe(404);
    const malformed = await patch("not-a-uuid", "admin", { status: "sold" });
    expect(malformed.status).toBe(404);
  });
});
