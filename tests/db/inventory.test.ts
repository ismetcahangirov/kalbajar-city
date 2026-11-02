import { randomUUID } from "node:crypto";

import { and, count, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { apartments, auditLog, blocks, buildings, floors, layoutTypes, leads } from "@/db/schema";
import { seed } from "@/db/seed";
import { HttpError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { AdminApartment, ApartmentBulkResult } from "@/shared/apartments";
import type { AdminBlock, AdminBuilding, AdminFloor, AdminLayoutType } from "@/shared/inventory";
import { csvColumns, type ImportReport } from "@/shared/inventory-csv";

import { createUser, origin, type TestUser } from "./accounts";
import { inRollback, type Tx } from "./helpers";

// Outside Next, "use cache" is inert; the cache calls are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as Array<[string, unknown]> }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string, profile: unknown) => void cache.revalidated.push([tag, profile]),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const { importApartments } = await import("@/lib/admin/inventory-import");
const { exportApartmentsCsv } = await import("@/lib/admin/apartments");
const apartmentsRoute = await import("@/app/api/v1/admin/apartments/route");
const apartmentRoute = await import("@/app/api/v1/admin/apartments/[id]/route");
const exportRoute = await import("@/app/api/v1/admin/apartments/export.csv/route");
const importRoute = await import("@/app/api/v1/admin/apartments/import/route");
const buildingsRoute = await import("@/app/api/v1/admin/buildings/route");
const buildingRoute = await import("@/app/api/v1/admin/buildings/[id]/route");
const blocksRoute = await import("@/app/api/v1/admin/blocks/route");
const blockRoute = await import("@/app/api/v1/admin/blocks/[id]/route");
const floorsRoute = await import("@/app/api/v1/admin/floors/route");
const floorRoute = await import("@/app/api/v1/admin/floors/[id]/route");
const layoutsRoute = await import("@/app/api/v1/admin/layout-types/route");
const layoutRoute = await import("@/app/api/v1/admin/layout-types/[id]/route");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const tag = randomUUID().slice(0, 4).toUpperCase();
const people = {} as Record<"owner" | "sales" | "editor", TestUser>;
const sessionUser = (person: TestUser): SessionUser => ({
  id: person.id,
  name: `Test ${person.role}`,
  email: person.email,
  role: person.role,
});
const headers = new Headers({ "user-agent": "vitest" });

beforeAll(async () => {
  for (const role of ["owner", "sales", "editor"] as const) people[role] = await createUser(role);
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

const header = csvColumns.map((column) => column.header).join(";");

/** A file of `rows` apartments of `block`: four per floor, `101`…`104`, `201`…. */
function inventoryFile(block: string, layout: string, rows: number): string[] {
  return Array.from({ length: rows }, (_, index) => {
    const floor = Math.floor(index / 4) + 1;
    const number = `${floor}${String((index % 4) + 1).padStart(2, "0")}`;
    return `${block};${floor};${number};${layout};62,09;satışda;125 000`;
  });
}

async function fixtureBlock(tx: Tx, code: string) {
  const [building] = await tx
    .insert(buildings)
    .values({ slug: `t-${code.toLowerCase()}-bina`, name: { az: "Test bina" } })
    .returning();
  const [block] = await tx
    .insert(blocks)
    .values({
      buildingId: building!.id,
      slug: `t-${code.toLowerCase()}-blok`,
      code,
      name: { az: `${code} blok` },
    })
    .returning();
  const [layout] = await tx
    .insert(layoutTypes)
    .values({
      slug: `t-${code.toLowerCase()}-plan`,
      code: `${code}-2`,
      rooms: 2,
      areaTotal: "62.09",
    })
    .returning();
  return { building: building!, block: block!, layout: layout! };
}

async function apartmentsIn(tx: Tx, blockId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(apartments)
    .innerJoin(floors, eq(floors.id, apartments.floorId))
    .where(eq(floors.blockId, blockId));
  return row?.n ?? 0;
}

async function refused(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpError) return error;
    throw error;
  }
  throw new Error("Expected the import to be refused");
}

describe("CSV import", () => {
  it("creates a 143-row file in one transaction, and a dry run writes nothing", async () => {
    await inRollback(async (tx) => {
      const code = `I${tag}`;
      const { block, layout } = await fixtureBlock(tx, code);
      const csv = [header, ...inventoryFile(code, layout.code, 143)].join("\r\n");
      const user = sessionUser(people.owner);

      const dry = await importApartments(tx, {
        input: { csv, mode: "upsert", dryRun: true, detachLeads: false },
        user,
        headers,
      });
      expect(dry).toMatchObject({ applied: false, rows: 143, created: 143, floorsCreated: 36 });
      expect(dry.issues).toEqual([]);
      expect(await apartmentsIn(tx, block.id)).toBe(0);
      expect(cache.revalidated).toEqual([]);

      const real = await importApartments(tx, {
        input: { csv, mode: "upsert", dryRun: false, detachLeads: false },
        user,
        headers,
      });
      expect(real).toMatchObject({ applied: true, created: 143, updated: 0, floorsCreated: 36 });
      expect(await apartmentsIn(tx, block.id)).toBe(143);
      expect(cache.revalidated).toEqual([["inventory", { expire: 0 }]]);

      const [stored] = await tx
        .select()
        .from(apartments)
        .where(eq(apartments.slug, `blok-${code.toLowerCase()}-menzil-3601`));
      expect(stored).toMatchObject({ number: "3601", priceMinor: 12_500_000, isDemo: false });
      const created = await tx
        .select({ n: count() })
        .from(auditLog)
        .where(and(eq(auditLog.action, "apartment.create"), eq(auditLog.actorId, user.id)));
      expect(created[0]?.n).toBe(143);

      // The same file again changes nothing.
      const again = await importApartments(tx, {
        input: { csv, mode: "upsert", dryRun: false, detachLeads: false },
        user,
        headers,
      });
      expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 143 });
    });
  });

  it("writes nothing from a file with invalid rows, and reports every one by line", async () => {
    await inRollback(async (tx) => {
      const code = `V${tag}`;
      const { block, layout } = await fixtureBlock(tx, code);
      const rows = inventoryFile(code, layout.code, 143);
      rows[9] = `${code};3;399;${layout.code};62,09;sold out;125 000`;
      rows[49] = `NOPE;13;1301;${layout.code};62,09;satışda;`;
      rows[99] = `${code};25;2504;NO-SUCH;62,09;satışda;`;
      rows[142] = rows[0]!;
      const csv = [header, ...rows].join("\n");

      const error = await refused(
        importApartments(tx, {
          input: { csv, mode: "upsert", dryRun: false, detachLeads: false },
          user: sessionUser(people.owner),
          headers,
        }),
      );
      expect(error.status).toBe(422);
      expect(error.code).toBe("IMPORT_INVALID");
      const report = error.details?.report as ImportReport;
      expect(report.applied).toBe(false);
      expect(report.issues.map(({ line, code: issue }) => [line, issue])).toEqual([
        [11, "status_unknown"],
        [144, "duplicate"],
        [51, "block_unknown"],
        [101, "layout_unknown"],
      ]);
      expect(await apartmentsIn(tx, block.id)).toBe(0);
      expect(cache.revalidated).toEqual([]);
    });
  });

  it("replaces the demo set: no is_demo row is left, leads keep their details", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const demo = await tx
        .select({
          id: apartments.id,
          slug: apartments.slug,
          number: apartments.number,
          block: blocks.code,
          floor: floors.number,
        })
        .from(apartments)
        .innerJoin(floors, eq(floors.id, apartments.floorId))
        .innerJoin(blocks, eq(blocks.id, floors.blockId))
        .where(eq(apartments.isDemo, true))
        .orderBy(blocks.sortOrder, floors.number, apartments.number);
      expect(demo).toHaveLength(143);
      const [layout] = await tx.select().from(layoutTypes).limit(1);

      // The owner's file names the first 100 demo apartments (blocks A to F and four of G).
      const kept = demo.slice(0, 100);
      const csv = [
        header,
        ...kept.map((row) => `${row.block};${row.floor};${row.number};${layout!.code};70;rezerv;`),
      ].join("\n");
      const removed = demo[120]!;
      const [lead] = await tx
        .insert(leads)
        .values({
          type: "inquiry",
          name: "Demo lead",
          phone: "+994501234567",
          apartmentId: removed.id,
          locale: "az",
          sourcePath: "/menziller",
        })
        .returning();
      const input = { csv, mode: "replaceDemo" as const, detachLeads: false };
      const user = sessionUser(people.owner);

      const dry = await importApartments(tx, { input: { ...input, dryRun: true }, user, headers });
      expect(dry).toMatchObject({
        applied: false,
        updated: 100,
        created: 0,
        demo: { apartments: 43, floors: 11, blocks: 2, buildings: 2, kept: 36, leads: 1 },
      });

      // A lead points at a demo apartment the import removes: refused until accepted.
      const error = await refused(
        importApartments(tx, { input: { ...input, dryRun: false }, user, headers }),
      );
      expect(error.status).toBe(409);
      expect(error.code).toBe("LEADS_LINKED");
      const [stillDemo] = await tx
        .select({ n: count() })
        .from(apartments)
        .where(eq(apartments.isDemo, true));
      expect(stillDemo?.n).toBe(143);

      const report = await importApartments(tx, {
        input: { ...input, dryRun: false, detachLeads: true },
        user,
        headers,
      });
      expect(report.applied).toBe(true);
      for (const table of [apartments, floors, blocks, buildings]) {
        const [left] = await tx.select({ n: count() }).from(table).where(eq(table.isDemo, true));
        expect(left?.n).toBe(0);
      }
      const rows = await tx.select().from(apartments);
      expect(rows).toHaveLength(100);
      // Apartments the file named keep their slugs, so public links survive.
      expect(new Set(rows.map((row) => row.slug))).toEqual(new Set(kept.map((row) => row.slug)));
      expect(rows.every((row) => row.status === "reserved")).toBe(true);
      const [after] = await tx.select().from(leads).where(eq(leads.id, lead!.id));
      expect(after).toMatchObject({ name: "Demo lead", apartmentId: null });
      const blockCodes = (await tx.select({ code: blocks.code }).from(blocks)).map((b) => b.code);
      expect(blockCodes.sort()).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    });
  });

  it("reads back its own export unchanged", async () => {
    await inRollback(async (tx) => {
      await seed(tx);
      const all = {
        status: [],
        block: [],
        rooms: [],
        floor: [],
        sort: { field: "number" as const, direction: "asc" as const },
      };
      const csv = await exportApartmentsCsv(tx, all);
      const user = sessionUser(people.owner);
      const input = { csv, mode: "upsert" as const, dryRun: false, detachLeads: false };
      // The first run only turns the demo rows into real ones; the second has nothing to do.
      const first = await importApartments(tx, { input, user, headers });
      expect(first).toMatchObject({ rows: 143, created: 0, updated: 143 });
      const second = await importApartments(tx, { input, user, headers });
      expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 143 });
    });
  });
});

let client = 0;

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Request {
  const requestHeaders = new Headers({
    "user-agent": "vitest",
    "x-forwarded-for": `192.0.2.${(client++ % 250) + 1}`,
  });
  if (init.cookie) requestHeaders.set("cookie", init.cookie);
  if (init.body !== undefined) requestHeaders.set("content-type", "application/json");
  return new Request(`${origin}/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: requestHeaders,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

type ErrorBody = {
  error: { code: string; fields?: Record<string, string[]>; dependents?: Record<string, number> };
};

describe("inventory endpoints", () => {
  const code = `E${tag}`;
  const created = {
    building: "",
    block: "",
    floors: [] as string[],
    layout: "",
    apartments: [] as string[],
  };

  afterAll(async () => {
    await db.delete(apartments).where(inArray(apartments.id, created.apartments));
    await db.delete(floors).where(inArray(floors.id, created.floors));
    if (created.block) await db.delete(blocks).where(eq(blocks.id, created.block));
    if (created.building) await db.delete(buildings).where(eq(buildings.id, created.building));
    if (created.layout) await db.delete(layoutTypes).where(eq(layoutTypes.id, created.layout));
  });

  const owner = () => people.owner.cookie;

  it("builds the structure, each write audited and revalidated, slugs from the Azerbaijani name", async () => {
    const building = await buildingsRoute.POST(
      request("/admin/buildings", {
        body: { name: { az: `Şəhər binası ${code}` }, sortOrder: "3" },
        cookie: owner(),
      }),
    );
    expect(building.status).toBe(201);
    const buildingBody = await json<AdminBuilding>(building);
    created.building = buildingBody.id;
    expect(buildingBody).toMatchObject({
      slug: `seher-binasi-${code.toLowerCase()}`,
      sortOrder: 3,
      blocks: 0,
    });

    const block = await blocksRoute.POST(
      request("/admin/blocks", {
        body: { buildingId: created.building, code: code.toLowerCase(), name: { az: "Test" } },
        cookie: owner(),
      }),
    );
    expect(block.status).toBe(201);
    const blockBody = await json<AdminBlock>(block);
    created.block = blockBody.id;
    expect(blockBody.code).toBe(code);

    const duplicate = await blocksRoute.POST(
      request("/admin/blocks", {
        body: { buildingId: created.building, code, name: { az: "Again" } },
        cookie: owner(),
      }),
    );
    expect(duplicate.status).toBe(422);
    expect((await json<ErrorBody>(duplicate)).error.fields).toHaveProperty("code");

    for (const number of [1, 2]) {
      const floor = await floorsRoute.POST(
        request("/admin/floors", { body: { blockId: created.block, number }, cookie: owner() }),
      );
      expect(floor.status).toBe(201);
      created.floors.push((await json<AdminFloor>(floor)).id);
    }

    const layout = await layoutsRoute.POST(
      request("/admin/layout-types", {
        body: {
          code: `${code}-2`,
          rooms: 2,
          areaTotal: "62,09",
          roomAreas: [
            { kind: "living", area: "20" },
            { kind: "bedroom", area: "14,5" },
          ],
          description: { az: "İki otaqlı", en: "", ru: "" },
        },
        cookie: owner(),
      }),
    );
    expect(layout.status).toBe(201);
    const layoutBody = await json<AdminLayoutType>(layout);
    created.layout = layoutBody.id;
    expect(layoutBody).toMatchObject({ rooms: 2, areaTotal: "62.09", apartments: 0 });

    // A partial update changes only what it sends.
    const renamed = await layoutRoute.PATCH(
      request(`/admin/layout-types/${created.layout}`, {
        method: "PATCH",
        body: { code: `${code}-2b` },
        cookie: owner(),
      }),
      context(created.layout),
    );
    expect(renamed.status).toBe(200);
    expect(await json<AdminLayoutType>(renamed)).toMatchObject({
      code: `${code}-2b`,
      roomAreas: [
        { kind: "living", area: "20" },
        { kind: "bedroom", area: "14.5" },
      ],
      description: { az: "İki otaqlı" },
    });

    for (const [floorId, number, priceMinor] of [
      [created.floors[0], "101", "12500000"],
      [created.floors[0], "102", null],
      [created.floors[1], "201", "13000000"],
    ] as const) {
      const apartment = await apartmentsRoute.POST(
        request("/admin/apartments", {
          body: {
            floorId,
            number,
            layoutTypeId: created.layout,
            areaTotal: "62.09",
            status: "not_for_sale",
            priceMinor,
          },
          cookie: owner(),
        }),
      );
      expect(apartment.status).toBe(201);
      const body = await json<AdminApartment>(apartment);
      created.apartments.push(body.id);
      expect(body).toMatchObject({ block: code, number, priceMinor });
    }
    const slugs = await db
      .select({ slug: apartments.slug })
      .from(apartments)
      .where(like(apartments.slug, `blok-${code.toLowerCase()}-menzil-%`));
    expect(slugs.map((row) => row.slug).sort()).toEqual(
      ["101", "102", "201"].map((n) => `blok-${code.toLowerCase()}-menzil-${n}`),
    );

    const taken = await apartmentsRoute.POST(
      request("/admin/apartments", {
        body: {
          floorId: created.floors[0],
          number: "101",
          layoutTypeId: created.layout,
          areaTotal: "62.09",
        },
        cookie: owner(),
      }),
    );
    expect(taken.status).toBe(422);
    expect((await json<ErrorBody>(taken)).error.fields).toHaveProperty("number");

    const audits = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.actorId, people.owner.id));
    expect(audits.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "building.create",
        "block.create",
        "floor.create",
        "layout_type.create",
        "layout_type.update",
        "apartment.create",
      ]),
    );
    expect(cache.revalidated.every(([tagName]) => tagName === "inventory")).toBe(true);
  });

  it("refuses to delete what other rows depend on, saying what", async () => {
    const cases = [
      [buildingRoute.DELETE, `/admin/buildings/${created.building}`, created.building, "blocks"],
      [blockRoute.DELETE, `/admin/blocks/${created.block}`, created.block, "floors"],
      [floorRoute.DELETE, `/admin/floors/${created.floors[0]}`, created.floors[0]!, "apartments"],
      [layoutRoute.DELETE, `/admin/layout-types/${created.layout}`, created.layout, "apartments"],
    ] as const;
    for (const [handler, path, id, dependent] of cases) {
      const response = await handler(
        request(path, { method: "DELETE", cookie: owner() }),
        context(id),
      );
      expect(response.status, path).toBe(409);
      const body = await json<ErrorBody>(response);
      expect(body.error.code).toBe("IN_USE");
      expect(body.error.dependents?.[dependent]).toBeGreaterThan(0);
    }

    // An empty floor goes.
    const floor = await floorsRoute.POST(
      request("/admin/floors", { body: { blockId: created.block, number: 9 }, cookie: owner() }),
    );
    const { id } = await json<AdminFloor>(floor);
    const removed = await floorRoute.DELETE(
      request(`/admin/floors/${id}`, { method: "DELETE", cookie: owner() }),
      context(id),
    );
    expect(removed.status).toBe(204);
  });

  it("lets sales change statuses, single and bulk, but never prices or anything else", async () => {
    const sales = people.sales.cookie;
    const [first, second, third] = created.apartments as [string, string, string];

    const single = await apartmentRoute.PATCH(
      request(`/admin/apartments/${first}`, {
        method: "PATCH",
        body: { priceMinor: "1" },
        cookie: sales,
      }),
      context(first),
    );
    expect(single.status).toBe(403);
    const number = await apartmentRoute.PATCH(
      request(`/admin/apartments/${first}`, {
        method: "PATCH",
        body: { status: "reserved", number: "999" },
        cookie: sales,
      }),
      context(first),
    );
    expect(number.status).toBe(403);
    for (const change of [
      { kind: "priceSet", priceMinor: "1" },
      { kind: "pricePercent", percent: 10 },
    ]) {
      const bulk = await apartmentsRoute.PATCH(
        request("/admin/apartments", {
          method: "PATCH",
          body: { ids: [first, second], change },
          cookie: sales,
        }),
      );
      expect(bulk.status, change.kind).toBe(403);
    }
    const prices = await db
      .select({ price: apartments.priceMinor })
      .from(apartments)
      .where(inArray(apartments.id, [first, second]));
    expect(prices.map((row) => row.price).sort()).toEqual([12_500_000, null].sort());

    // Publishing puts the not-for-sale ones on sale, one audit entry per apartment.
    const publish = await apartmentsRoute.PATCH(
      request("/admin/apartments", {
        method: "PATCH",
        body: { ids: [first, second, third], change: { kind: "publish" } },
        cookie: sales,
      }),
    );
    expect(publish.status).toBe(200);
    expect(await json<ApartmentBulkResult>(publish)).toEqual({ updated: 3, unchanged: 0 });
    const entries = await db
      .select({ entityId: auditLog.entityId, after: auditLog.after })
      .from(auditLog)
      .where(and(eq(auditLog.actorId, people.sales.id), eq(auditLog.action, "apartment.update")));
    expect(entries.map((entry) => entry.entityId).sort()).toEqual([first, second, third].sort());
    expect(entries.every((entry) => entry.after?.status === "available")).toBe(true);
    expect(cache.revalidated).toContainEqual(["inventory", { expire: 0 }]);

    const sold = await apartmentsRoute.PATCH(
      request("/admin/apartments", {
        method: "PATCH",
        body: { ids: [first], change: { kind: "status", status: "sold" } },
        cookie: sales,
      }),
    );
    expect(await json<ApartmentBulkResult>(sold)).toEqual({ updated: 1, unchanged: 0 });
    // Publishing again leaves the sold one sold.
    const again = await apartmentsRoute.PATCH(
      request("/admin/apartments", {
        method: "PATCH",
        body: { ids: [first, second], change: { kind: "publish" } },
        cookie: sales,
      }),
    );
    expect(await json<ApartmentBulkResult>(again)).toEqual({ updated: 0, unchanged: 2 });
  });

  it("changes prices in bulk for inventory editors, to the qəpik the preview shows", async () => {
    const [first, second, third] = created.apartments as [string, string, string];
    const response = await apartmentsRoute.PATCH(
      request("/admin/apartments", {
        method: "PATCH",
        body: { ids: [first, second, third], change: { kind: "pricePercent", percent: -2.5 } },
        cookie: owner(),
      }),
    );
    expect(await json<ApartmentBulkResult>(response)).toEqual({ updated: 2, unchanged: 1 });
    const rows = await db
      .select({ id: apartments.id, price: apartments.priceMinor })
      .from(apartments)
      .where(inArray(apartments.id, [first, second, third]));
    const price = new Map(rows.map((row) => [row.id, row.price]));
    expect([price.get(first), price.get(second), price.get(third)]).toEqual([
      12_187_500,
      null,
      12_675_000,
    ]);

    const unknown = await apartmentsRoute.PATCH(
      request("/admin/apartments", {
        method: "PATCH",
        body: { ids: [first, randomUUID()], change: { kind: "unpublish" } },
        cookie: owner(),
      }),
    );
    expect(unknown.status).toBe(422);
  });

  it("exports the filtered list as CSV and keeps writes from roles without the permission", async () => {
    const response = await exportRoute.GET(
      request(`/admin/apartments/export.csv?block=${code}`, { cookie: people.sales.cookie }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="menziller-/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // A byte order mark, so Excel reads the file as UTF-8.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes);
    expect(text.trim().split("\r\n")).toHaveLength(4);
    expect(text).toContain(`${code};1;101;${code}-2b;62,09;satılıb;121875`);

    const editorRead = await exportRoute.GET(
      request("/admin/apartments/export.csv", { cookie: people.editor.cookie }),
    );
    expect(editorRead.status).toBe(403);
    const salesBuilding = await buildingsRoute.POST(
      request("/admin/buildings", { body: { name: { az: "X" } }, cookie: people.sales.cookie }),
    );
    expect(salesBuilding.status).toBe(403);
    const salesImport = await importRoute.POST(
      request("/admin/apartments/import", {
        body: { csv: header, mode: "upsert", dryRun: true },
        cookie: people.sales.cookie,
      }),
    );
    expect(salesImport.status).toBe(403);
    const salesDelete = await apartmentRoute.DELETE(
      request(`/admin/apartments/${created.apartments[0]}`, {
        method: "DELETE",
        cookie: people.sales.cookie,
      }),
      context(created.apartments[0]!),
    );
    expect(salesDelete.status).toBe(403);
  });

  it("answers a dry-run import through the endpoint with the report", async () => {
    const csv = [header, `${code};1;101;${code}-2b;62,09;rezerv;`, `${code};1;1x!;nope;0;?;`].join(
      "\n",
    );
    const response = await importRoute.POST(
      request("/admin/apartments/import", {
        body: { csv, mode: "upsert", dryRun: true },
        cookie: owner(),
      }),
    );
    expect(response.status).toBe(200);
    const report = await json<ImportReport>(response);
    expect(report.applied).toBe(false);
    expect(report.issues.map((issue) => [issue.line, issue.code])).toEqual([
      [3, "number_format"],
      [3, "area_format"],
      [3, "status_unknown"],
    ]);

    const real = await importRoute.POST(
      request("/admin/apartments/import", {
        body: { csv, mode: "upsert", dryRun: false },
        cookie: owner(),
      }),
    );
    expect(real.status).toBe(422);
    const body = await json<ErrorBody & { error: { report: ImportReport } }>(real);
    expect(body.error.code).toBe("IMPORT_INVALID");
    expect(body.error.report.issues).toHaveLength(3);
  });
});
