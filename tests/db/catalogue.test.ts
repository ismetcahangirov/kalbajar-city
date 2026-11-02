import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import {
  apartments,
  blocks,
  buildings,
  floors,
  layoutTypes,
  media,
  mediaUsages,
  settings,
} from "@/db/schema";
import { apartmentListQuerySchema } from "@/shared/apartments";

// Outside Next, "use cache" is inert; the cache calls do nothing here.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.stubEnv("S3_PUBLIC_URL", "https://cdn.test/kalbajar");
// The loaders read through `getDb()`, which connects to DATABASE_URL.
process.env.DATABASE_URL = inject("databaseUrl");

const loaders = await import("@/lib/public/apartments");
const publicList = await import("@/app/api/v1/apartments/route");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

/** Unique per run, so these fixtures never meet seeded or other tests' rows. */
const tag = randomUUID().slice(0, 6);
const blockCode = `C${tag.slice(0, 4)}`.toUpperCase();
const slugOf = (name: string) => `c-${tag}-${name}`;
const ids = {
  building: "",
  block: "",
  floors: [] as string[],
  layouts: [] as string[],
  apartments: [] as string[],
  media: "",
};

beforeAll(async () => {
  const [building] = await db
    .insert(buildings)
    .values({ slug: slugOf("bina"), name: { az: "Kataloq bina" } })
    .returning();
  const [block] = await db
    .insert(blocks)
    .values({
      buildingId: building!.id,
      slug: slugOf("blok"),
      code: blockCode,
      name: { az: `${blockCode} blok` },
    })
    .returning();
  const floorRows = await db
    .insert(floors)
    .values([1, 2].map((number) => ({ blockId: block!.id, number })))
    .returning();
  const layoutRows = await db
    .insert(layoutTypes)
    .values([
      { slug: slugOf("2"), code: `${tag}-2`, rooms: 2, areaTotal: "70.00" },
      { slug: slugOf("3"), code: `${tag}-3`, rooms: 3, areaTotal: "100.00" },
    ])
    .returning();
  const [two, three] = layoutRows;
  const [first, second] = floorRows;
  const rows = await db
    .insert(apartments)
    .values(
      [
        // number, floor, layout, status, area, price (qəpik)
        ["11", first, two, "available", "70.00", 12_000_000],
        ["12", first, two, "available", "72.50", 10_000_000],
        ["13", first, two, "reserved", "70.40", 11_000_000],
        ["21", second, two, "available", "88.00", null],
        ["22", second, three, "available", "100.00", 20_000_000],
        ["23", second, two, "sold", "70.10", 9_000_000],
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
  const [image] = await db
    .insert(media)
    .values({
      key: `catalogue-test/${tag}.jpg`,
      kind: "image",
      mimeType: "image/jpeg",
      size: 1000,
      width: 1200,
      height: 800,
      alt: { az: "Qonaq otağı" },
    })
    .returning();
  await db.insert(mediaUsages).values({
    mediaId: image!.id,
    entityType: "layout_types",
    entityId: two!.id,
    field: "gallery",
  });
  ids.building = building!.id;
  ids.block = block!.id;
  ids.floors = floorRows.map((row) => row.id);
  ids.layouts = layoutRows.map((row) => row.id);
  ids.apartments = rows.map((row) => row.id);
  ids.media = image!.id;
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(mediaUsages).where(eq(mediaUsages.mediaId, ids.media));
  await db.delete(media).where(eq(media.id, ids.media));
  await db.delete(apartments).where(inArray(apartments.id, ids.apartments));
  await db.delete(layoutTypes).where(inArray(layoutTypes.id, ids.layouts));
  await db.delete(floors).where(inArray(floors.id, ids.floors));
  await db.delete(blocks).where(eq(blocks.id, ids.block));
  await db.delete(buildings).where(eq(buildings.id, ids.building));
  await db.delete(settings).where(eq(settings.key, "prices"));
});

async function setPricesVisible(visible: boolean) {
  await db
    .insert(settings)
    .values({ key: "prices", value: { visible } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { visible } } });
}

function query(input: Record<string, string>) {
  return apartmentListQuerySchema.parse({ block: blockCode, pageSize: "50", ...input });
}

async function numbers(input: Record<string, string>) {
  return (await loaders.listPublicApartments(query(input))).items.map((item) => item.number);
}

describe("price filter and sort", () => {
  it("are ignored while prices are hidden, so neither leaks", async () => {
    await setPricesVisible(false);
    expect(await numbers({ priceMax: "10500000" })).toEqual(["11", "12", "13", "21", "22", "23"]);
    expect(await numbers({ sort: "price" })).toEqual(["11", "12", "13", "21", "22", "23"]);
    const page = await loaders.listPublicApartments(query({}));
    expect(page.items.every((item) => item.price === null)).toBe(true);
  });

  it("filter by a range in minor units once prices are public", async () => {
    await setPricesVisible(true);
    expect(await numbers({ priceMin: "10000000", priceMax: "12000000" })).toEqual([
      "11",
      "12",
      "13",
    ]);
    // An apartment without a price never matches a price range.
    expect(await numbers({ priceMin: "0" })).not.toContain("21");
  });

  it("sort by price both ways, apartments without a price last", async () => {
    await setPricesVisible(true);
    expect(await numbers({ sort: "price" })).toEqual(["23", "12", "13", "11", "22", "21"]);
    expect(await numbers({ sort: "-price" })).toEqual(["22", "11", "13", "12", "23", "21"]);
  });

  it("reach the public API with the same rule", async () => {
    const list = async () => {
      const response = await publicList.GET(
        new Request(
          `http://localhost/api/v1/apartments?block=${blockCode}&priceMax=10000000&sort=-price`,
        ),
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { items: Array<{ number: string }> }).items.map(
        (item) => item.number,
      );
    };
    await setPricesVisible(true);
    expect(await list()).toEqual(["12", "23"]);
    await setPricesVisible(false);
    expect(await list()).toEqual(["11", "12", "13", "21", "22", "23"]);
  });

  it("refuse a price range that is upside down", () => {
    expect(apartmentListQuerySchema.safeParse({ priceMin: "200", priceMax: "100" }).success).toBe(
      false,
    );
  });
});

describe("getCatalogueFacets", () => {
  it("offers the values public apartments have, and prices only when public", async () => {
    await setPricesVisible(false);
    const hidden = await loaders.getCatalogueFacets("az");
    expect(hidden.blocks).toContainEqual({
      code: blockCode,
      name: { value: `${blockCode} blok`, locale: "az", fallback: false },
    });
    expect(hidden.rooms).toEqual(expect.arrayContaining([2, 3]));
    expect(hidden.floors).toEqual(expect.arrayContaining([1, 2]));
    expect(hidden).toMatchObject({ price: null, pricesVisible: false });

    await setPricesVisible(true);
    const visible = await loaders.getCatalogueFacets("az");
    expect(visible.pricesVisible).toBe(true);
    // Whole manat, rounded outwards so the range holds every price.
    expect(visible.price?.min).toBeLessThanOrEqual(90_000);
    expect(visible.price?.max).toBeGreaterThanOrEqual(200_000);
  });
});

describe("listSimilarApartments", () => {
  it("lists available apartments with the same rooms, nearest in area, never itself", async () => {
    const similar = await loaders.listSimilarApartments(
      { slug: slugOf("m-11"), rooms: 2, areaTotal: "70.00" },
      "az",
    );
    const mine = similar.filter((item) => item.block.code === blockCode);
    // 13 is reserved and 23 sold; 22 has three rooms.
    expect(mine.map((item) => item.number)).toEqual(["12", "21"]);
    expect(similar.length).toBeLessThanOrEqual(4);
    expect(similar.every((item) => item.status === "available" && item.rooms === 2)).toBe(true);
  });
});

describe("getPublicApartment", () => {
  it("includes the layout's gallery from the media library", async () => {
    const apartment = await loaders.getPublicApartment(slugOf("m-12"), "en");
    expect(apartment?.gallery).toEqual([
      expect.objectContaining({
        src: `https://cdn.test/kalbajar/catalogue-test/${tag}.jpg`,
        alt: "Qonaq otağı",
        width: 1200,
        height: 800,
      }),
    ]);
    const other = await loaders.getPublicApartment(slugOf("m-22"), "az");
    expect(other?.gallery).toEqual([]);
  });
});
