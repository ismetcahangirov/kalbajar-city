import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import {
  apartments,
  auditLog,
  blocks,
  buildings,
  floors,
  layoutTypes,
  media,
  selectorViews,
} from "@/db/schema";
import type { Polygon } from "@/shared/complex";
import type { AdminSelectorView } from "@/shared/selector";

import { createUser, origin, type TestUser } from "./accounts";
import { violates } from "./helpers";

const cache = vi.hoisted(() => ({ revalidated: [] as string[] }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string) => void cache.revalidated.push(tag),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.stubEnv("S3_PUBLIC_URL", "https://cdn.test/kalbajar");

const viewRoute = await import("@/app/api/v1/admin/selector/route");
const pictureRoute = await import("@/app/api/v1/admin/selector/picture/route");
const hotspotRoute = await import("@/app/api/v1/admin/selector/hotspot/route");
const { getComplexSelector } = await import("@/lib/public/complex");
const { mediaUsages } = await import("@/lib/media/usages");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const tag = randomUUID().slice(0, 4).toUpperCase();
const people = {} as Record<"owner" | "sales", TestUser>;

let client = 0;
function request(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers = new Headers({
    "user-agent": "vitest",
    "x-forwarded-for": `192.0.2.${(client++ % 250) + 1}`,
  });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "PUT"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const r = (value: number) => Math.round(value * 10_000) / 10_000;
const square = (x: number, y: number, size = 0.2): Polygon => [
  [r(x), r(y)],
  [r(x + size), r(y)],
  [r(x + size), r(y + size)],
  [r(x), r(y + size)],
];

// Committed fixtures: the public loader reads through its own connection.
const fixture = {
  building: "",
  block: "",
  code: `S${tag}`,
  floors: [] as string[],
  layout: "",
  apartments: [] as string[],
  media: [] as string[],
};

beforeAll(async () => {
  for (const role of ["owner", "sales"] as const) people[role] = await createUser(role);
  const [building] = await db
    .insert(buildings)
    .values({ slug: `t-sel-${tag.toLowerCase()}`, name: { az: "Seçici bina" } })
    .returning();
  const [block] = await db
    .insert(blocks)
    .values({
      buildingId: building!.id,
      slug: `t-sel-${tag.toLowerCase()}-blok`,
      code: fixture.code,
      name: { az: `${fixture.code} blok` },
      sortOrder: 9_999,
    })
    .returning();
  const [layout] = await db
    .insert(layoutTypes)
    .values({ slug: `t-sel-${tag.toLowerCase()}`, code: `S${tag}-1`, rooms: 1, areaTotal: "40" })
    .returning();
  const floorRows = await db
    .insert(floors)
    .values([1, 2].map((number) => ({ blockId: block!.id, number })))
    .returning();
  const apartmentRows = await db
    .insert(apartments)
    .values(
      floorRows.flatMap((floor) =>
        [1, 2].map((i) => ({
          slug: `t-sel-${tag.toLowerCase()}-${floor.number}0${i}`,
          number: `${floor.number}0${i}`,
          floorId: floor.id,
          layoutTypeId: layout!.id,
          areaTotal: "40",
        })),
      ),
    )
    .returning();
  const files = await db
    .insert(media)
    .values(
      ["facade", "plan"].map((name) => ({
        key: `selector-test/${tag}/${name}.jpg`,
        kind: "image" as const,
        mimeType: "image/jpeg",
        size: 1000,
        width: 1600,
        height: 900,
        alt: { az: `Test ${name}` },
        variants: [
          {
            key: `media/${tag}/${name}-800.webp`,
            format: "webp" as const,
            width: 800,
            height: 450,
            size: 100,
          },
        ],
      })),
    )
    .returning();
  Object.assign(fixture, {
    building: building!.id,
    block: block!.id,
    layout: layout!.id,
    floors: floorRows.map((row) => row.id),
    apartments: apartmentRows.map((row) => row.id),
    media: files.map((row) => row.id),
  });
});

afterAll(async () => {
  await db.delete(selectorViews).where(eq(selectorViews.blockId, fixture.block));
  await db.delete(apartments).where(inArray(apartments.id, fixture.apartments));
  await db.delete(floors).where(inArray(floors.id, fixture.floors));
  await db.delete(blocks).where(eq(blocks.id, fixture.block));
  await db.delete(buildings).where(eq(buildings.id, fixture.building));
  await db.delete(layoutTypes).where(eq(layoutTypes.id, fixture.layout));
  await db.delete(media).where(inArray(media.id, fixture.media));
});

const owner = () => people.owner.cookie;

describe("complex selector editor endpoints", () => {
  it("reads a block's facade with a hotspot per floor, highest first", async () => {
    const response = await viewRoute.GET(
      request(`/admin/selector?block=${fixture.block}`, { cookie: owner() }),
    );
    expect(response.status).toBe(200);
    const view = (await response.json()) as AdminSelectorView;
    expect(view).toMatchObject({ level: "block", id: fixture.block, picture: null });
    expect(view.hotspots.map((item) => item.label)).toEqual(["2", "1"]);
    expect(view.hotspots.every((item) => item.polygon === null)).toBe(true);
  });

  it("sets a facade picture and draws floors on it, audited", async () => {
    const [facade, plan] = fixture.media;
    const set = await pictureRoute.PUT(
      request("/admin/selector/picture", {
        body: { level: "block", id: fixture.block, mediaId: facade },
        cookie: owner(),
      }),
    );
    expect(set.status).toBe(200);
    const view = (await set.json()) as AdminSelectorView;
    expect(view.picture).toMatchObject({
      id: facade,
      width: 1600,
      height: 900,
      url: `https://cdn.test/kalbajar/media/${tag}/facade-800.webp`,
      missingAlt: false,
    });
    expect(cache.revalidated).toContain("inventory");

    for (const [index, id] of fixture.floors.entries()) {
      const drawn = await hotspotRoute.PUT(
        request("/admin/selector/hotspot", {
          body: { level: "block", id, polygon: square(0.1, 0.5 - index * 0.3) },
          cookie: owner(),
        }),
      );
      expect(drawn.status).toBe(200);
    }
    const [floor] = await db.select().from(floors).where(eq(floors.id, fixture.floors[0]!));
    expect(floor!.facadePolygon).toEqual(square(0.1, 0.5));
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, fixture.floors[0]!), eq(auditLog.action, "floor.hotspot")));
    expect(logged).toHaveLength(1);

    // A floor's picture is its plan.
    const planned = await pictureRoute.PUT(
      request("/admin/selector/picture", {
        body: { level: "floor", id: fixture.floors[0], mediaId: plan },
        cookie: owner(),
      }),
    );
    expect(planned.status).toBe(200);
    expect(((await planned.json()) as AdminSelectorView).level).toBe("floor");
    const [withPlan] = await db.select().from(floors).where(eq(floors.id, fixture.floors[0]!));
    expect(withPlan!.planMediaId).toBe(plan);

    // The library knows where the facade is used.
    const usages = await mediaUsages(db, facade!);
    expect(usages).toContainEqual(
      expect.objectContaining({
        entityType: "selector_view",
        field: "facade",
        label: fixture.code,
      }),
    );
  });

  it("shows the public selector drawn levels only when complete", async () => {
    const data = await getComplexSelector("az");
    const block = data.blocks.find((item) => item.code === fixture.code);
    expect(block?.facade).toMatchObject({ width: 1600, height: 900, alt: "Test facade" });
    expect(block?.floors.map((floor) => floor.facadePolygon)).toEqual([
      square(0.1, 0.5),
      square(0.1, 0.2),
    ]);
    const [first] = block!.floors;
    expect(first!.plan?.alt).toBe("Test plan");
    // The plan's apartments are not drawn yet.
    expect(first!.apartments.every((item) => item.planPolygon === null)).toBe(true);
  });

  it("refuses shapes that are not polygons inside the picture", async () => {
    for (const polygon of [
      [
        [0, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [2, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0.5, 0.5],
        [1, 1],
      ],
      "M0 0",
    ]) {
      const response = await hotspotRoute.PUT(
        request("/admin/selector/hotspot", {
          body: { level: "floor", id: fixture.apartments[0], polygon },
          cookie: owner(),
        }),
      );
      expect(response.status).toBe(422);
    }
    const missing = await hotspotRoute.PUT(
      request("/admin/selector/hotspot", {
        body: { level: "floor", id: randomUUID(), polygon: square(0, 0) },
        cookie: owner(),
      }),
    );
    expect(missing.status).toBe(404);
    const noBlock = await pictureRoute.PUT(
      request("/admin/selector/picture", {
        body: { level: "block", mediaId: fixture.media[0] },
        cookie: owner(),
      }),
    );
    expect(noBlock.status).toBe(422);
  });

  it("lets sales read but not draw", async () => {
    const read = await viewRoute.GET(request("/admin/selector", { cookie: people.sales.cookie }));
    expect(read.status).toBe(200);
    const write = await hotspotRoute.PUT(
      request("/admin/selector/hotspot", {
        body: { level: "floor", id: fixture.apartments[0], polygon: square(0, 0) },
        cookie: people.sales.cookie,
      }),
    );
    expect(write.status).toBe(403);
    const anonymous = await viewRoute.GET(request("/admin/selector"));
    expect(anonymous.status).toBe(401);
  });

  it("clears a picture and keeps one site row at most", async () => {
    const cleared = await pictureRoute.PUT(
      request("/admin/selector/picture", {
        body: { level: "block", id: fixture.block, mediaId: null },
        cookie: owner(),
      }),
    );
    expect(((await cleared.json()) as AdminSelectorView).picture).toBeNull();
    await violates(db as never, "selector_views_site", async (sp) => {
      await sp.insert(selectorViews).values([
        { blockId: null, mediaId: fixture.media[0]! },
        { blockId: null, mediaId: fixture.media[1]! },
      ]);
    });
    await violates(db as never, "apartments_plan_polygon_array", async (sp) => {
      await sp
        .update(apartments)
        .set({ planPolygon: { x: 1 } as never })
        .where(eq(apartments.id, fixture.apartments[0]!));
    });
  });
});
