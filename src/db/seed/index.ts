import { count, eq } from "drizzle-orm";

import { slugify } from "@/lib/slug";
import { homeSectionContentSchemas, homeSectionKeys } from "@/shared/home-sections";
import type { ApartmentStatus } from "@/shared/inventory";
import { settingsKeys, settingsSchemas } from "@/shared/settings";

import type { Executor } from "../client";
import * as schema from "../schema";
import * as data from "./data";

export function layoutSlug(layout: data.SeedLayout): string {
  return slugify(`${layout.rooms} otaq ${layout.areaTotal}`);
}

export function layoutCode(layout: data.SeedLayout): string {
  return `${layout.rooms}-${Math.floor(Number(layout.areaTotal))}`;
}

/** A fixed, varied spread of statuses so the catalogue's filters have something to show. */
function demoStatus(index: number): ApartmentStatus {
  if (index % 23 === 11) return "not_for_sale";
  if (index % 9 === 4) return "sold";
  if (index % 7 === 3) return "reserved";
  return "available";
}

/** The demo inventory as plain rows that reference each other by code. */
export function demoInventoryPlan() {
  const { blocksPerBuilding, blockCodes, floorsPerBlock, apartmentsPerFloor } = data.demoInventory;

  const buildings = blocksPerBuilding.map((_, i) => ({
    slug: `bina-${i + 1}`,
    name: { az: `Bina ${i + 1}`, en: `Building ${i + 1}`, ru: `Корпус ${i + 1}` },
    sortOrder: i,
  }));

  let nextBlock = 0;
  const blocks = blocksPerBuilding.flatMap((size, b) =>
    Array.from({ length: size }, () => {
      const code = blockCodes[nextBlock];
      if (!code) throw new Error("demoInventory.blockCodes is shorter than the block count");
      const block = {
        code,
        slug: slugify(`blok ${code}`),
        buildingSlug: buildings[b]!.slug,
        name: { az: `${code} blok`, en: `Block ${code}`, ru: `Блок ${code}` },
        sortOrder: nextBlock,
      };
      nextBlock++;
      return block;
    }),
  );

  const floors = blocks.flatMap((block) =>
    Array.from({ length: floorsPerBlock }, (_, f) => ({ blockCode: block.code, number: f + 1 })),
  );

  const apartments = floors
    .flatMap((floor) =>
      Array.from({ length: apartmentsPerFloor }, (_, p) => {
        const number = `${floor.number}${String(p + 1).padStart(2, "0")}`;
        return { ...floor, apartmentNumber: number };
      }),
    )
    .slice(0, data.demoInventory.apartments)
    .map((slot, i) => {
      const layout = data.layouts[i % data.layouts.length]!;
      return {
        slug: slugify(`blok ${slot.blockCode} menzil ${slot.apartmentNumber}`),
        number: slot.apartmentNumber,
        blockCode: slot.blockCode,
        floor: slot.number,
        layoutSlug: layoutSlug(layout),
        areaTotal: layout.areaTotal,
        status: demoStatus(i),
      };
    });

  return { buildings, blocks, floors, apartments };
}

export type SeedReport = Record<string, number | "skipped">;

/**
 * Loads the facts known today and the demo inventory. Idempotent: rows that
 * already exist (by slug or key) are left alone, so console edits survive a
 * re-run, and the demo inventory is skipped once real apartments exist.
 */
export async function seed(db: Executor): Promise<SeedReport> {
  for (const key of settingsKeys) settingsSchemas[key].parse(data.settings[key]);
  for (const key of homeSectionKeys) homeSectionContentSchemas[key].parse(data.homeSections[key]);

  return db.transaction(async (tx) => {
    const report: SeedReport = {};

    report.settings = (
      await tx
        .insert(schema.settings)
        .values(settingsKeys.map((key) => ({ key, value: data.settings[key] })))
        .onConflictDoNothing()
        .returning()
    ).length;

    report.layoutTypes = (
      await tx
        .insert(schema.layoutTypes)
        .values(
          data.layouts.map((layout, i) => ({
            slug: layoutSlug(layout),
            code: layoutCode(layout),
            rooms: layout.rooms,
            areaTotal: layout.areaTotal,
            roomAreas: layout.roomAreas,
            sortOrder: i,
          })),
        )
        .onConflictDoNothing()
        .returning()
    ).length;

    report.homeSections = (
      await tx
        .insert(schema.homeSections)
        .values(
          homeSectionKeys.map((key, i) => ({ key, sortOrder: i, content: data.homeSections[key] })),
        )
        .onConflictDoNothing()
        .returning()
    ).length;

    report.galleryCategories = (
      await tx
        .insert(schema.galleryCategories)
        .values(data.galleryCategories.map((category, i) => ({ ...category, sortOrder: i })))
        .onConflictDoNothing()
        .returning()
    ).length;

    // FAQ rows have no natural key, so they are only seeded into an empty table.
    const [faqRows] = await tx.select({ n: count() }).from(schema.faq);
    report.faq =
      faqRows?.n === 0
        ? (
            await tx
              .insert(schema.faq)
              .values(data.faq.map((item, i) => ({ ...item, sortOrder: i })))
              .returning()
          ).length
        : "skipped";

    const [realApartments] = await tx
      .select({ n: count() })
      .from(schema.apartments)
      .where(eq(schema.apartments.isDemo, false));
    if (realApartments && realApartments.n > 0) {
      report.demoInventory = "skipped";
      return report;
    }

    const plan = demoInventoryPlan();

    report.buildings = (
      await tx
        .insert(schema.buildings)
        .values(plan.buildings.map((b) => ({ ...b, isDemo: true })))
        .onConflictDoNothing()
        .returning()
    ).length;
    const buildingIds = new Map(
      (await tx.select().from(schema.buildings)).map((row) => [row.slug, row.id]),
    );

    report.blocks = (
      await tx
        .insert(schema.blocks)
        .values(
          plan.blocks.map(({ buildingSlug, ...block }) => ({
            ...block,
            buildingId: must(buildingIds.get(buildingSlug), buildingSlug),
            isDemo: true,
          })),
        )
        .onConflictDoNothing()
        .returning()
    ).length;
    const blockIds = new Map(
      (await tx.select().from(schema.blocks)).map((row) => [row.code, row.id]),
    );

    report.floors = (
      await tx
        .insert(schema.floors)
        .values(
          plan.floors.map((floor) => ({
            blockId: must(blockIds.get(floor.blockCode), floor.blockCode),
            number: floor.number,
            isDemo: true,
          })),
        )
        .onConflictDoNothing()
        .returning()
    ).length;
    const floorIds = new Map(
      (await tx.select().from(schema.floors)).map((row) => [
        `${row.blockId}:${row.number}`,
        row.id,
      ]),
    );

    const layoutIds = new Map(
      (await tx.select().from(schema.layoutTypes)).map((row) => [row.slug, row.id]),
    );

    report.apartments = (
      await tx
        .insert(schema.apartments)
        .values(
          plan.apartments.map(({ blockCode, floor, layoutSlug: layout, ...apartment }) => {
            const floorKey = `${must(blockIds.get(blockCode), blockCode)}:${floor}`;
            return {
              ...apartment,
              floorId: must(floorIds.get(floorKey), floorKey),
              layoutTypeId: must(layoutIds.get(layout), layout),
              isDemo: true,
            };
          }),
        )
        .onConflictDoNothing()
        .returning()
    ).length;

    return report;
  });
}

function must<T>(value: T | undefined, key: string): T {
  if (value === undefined) throw new Error(`Seed reference not found: ${key}`);
  return value;
}
