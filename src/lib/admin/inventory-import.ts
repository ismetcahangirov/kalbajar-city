import "server-only";

import { and, count, eq, inArray, notExists } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { apartments, blocks, buildings, floors, layoutTypes, leads } from "@/db/schema";
import { HttpError } from "@/lib/api/errors";
import { audit, auditMany, type AuditEntry } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  parseInventoryCsv,
  type ImportIssue,
  type ImportReport,
  type importRequestSchema,
} from "@/shared/inventory-csv";

type Input = z.output<typeof importRequestSchema>;

/** Carries a dry run's report out of the transaction it rolls back. */
class DryRun extends Error {
  constructor(readonly report: ImportReport) {
    super("dry run");
  }
}

const sameArea = (a: string, b: string) => Number(a) === Number(b);

/**
 * Imports the apartments CSV (#24) in one transaction: every row is written,
 * or none is.
 *
 * - `upsert`: an apartment found by block code and number is updated, any
 *   other row is added. Floors a row names that do not exist yet are added;
 *   blocks and layouts must exist (the console creates them).
 * - `replaceDemo`: the same, and the demo inventory goes. Demo apartments the
 *   file names become real ones (keeping their slugs and leads); the others
 *   are removed, then the demo floors, blocks and buildings nothing uses any
 *   more. Those still used are kept and no longer marked demo, so no
 *   `is_demo` row is left. Leads pointing at a removed apartment lose the link
 *   (`set null`), which the caller must accept with `detachLeads`.
 *
 * A dry run does all of it and rolls back, so its report is exactly what the
 * real run would do. With any invalid row nothing is written: a real run
 * answers 422 `IMPORT_INVALID` with the report.
 */
export async function importApartments(
  db: Executor,
  { input, user, headers }: { input: Input; user: SessionUser; headers: Headers },
): Promise<ImportReport> {
  const parsed = parseInventoryCsv(input.csv);
  const report: ImportReport = {
    mode: input.mode,
    dryRun: input.dryRun,
    applied: false,
    rows: parsed.total,
    issues: parsed.issues,
    created: 0,
    updated: 0,
    unchanged: 0,
    floorsCreated: 0,
    demo: { apartments: 0, floors: 0, blocks: 0, buildings: 0, kept: 0, leads: 0 },
  };
  // A file that does not read as a whole (no header, a missing column) stops here.
  if (!parsed.rows.length) {
    if (!input.dryRun) throw invalidImport(report);
    return report;
  }

  try {
    await db.transaction(async (tx) => {
      await write(tx, input, parsed.rows, report, { user, headers });
      if (report.issues.length) throw input.dryRun ? new DryRun(report) : invalidImport(report);
      if (input.mode === "replaceDemo" && report.demo.leads > 0 && !input.detachLeads) {
        if (input.dryRun) throw new DryRun(report);
        throw new HttpError(
          409,
          "LEADS_LINKED",
          "Leads point at demo apartments the import removes; send detachLeads to unlink them.",
          undefined,
          { report },
        );
      }
      if (input.dryRun) throw new DryRun(report);
    });
  } catch (error) {
    if (error instanceof DryRun) return error.report;
    throw error;
  }

  report.applied = true;
  revalidatePublic(publicTags.inventory);
  return report;
}

function invalidImport(report: ImportReport): HttpError {
  return new HttpError(
    422,
    "IMPORT_INVALID",
    "The file has invalid rows; nothing was written.",
    undefined,
    { report },
  );
}

async function write(
  tx: Executor,
  input: Input,
  rows: ReturnType<typeof parseInventoryCsv>["rows"],
  report: ImportReport,
  { user, headers }: { user: SessionUser; headers: Headers },
): Promise<void> {
  const issues: ImportIssue[] = report.issues;
  const [blockRows, layoutRows, floorRows, existing] = await Promise.all([
    tx.select({ id: blocks.id, code: blocks.code }).from(blocks),
    tx.select({ id: layoutTypes.id, code: layoutTypes.code }).from(layoutTypes),
    tx.select({ id: floors.id, blockId: floors.blockId, number: floors.number }).from(floors),
    tx
      .select({ apartment: apartments, blockId: floors.blockId })
      .from(apartments)
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .for("update", { of: apartments }),
  ]);
  const blockIds = new Map(blockRows.map((row) => [row.code, row.id]));
  // Layout codes are matched without regard to case, like block codes.
  const layoutIds = new Map(layoutRows.map((row) => [row.code.toUpperCase(), row.id]));
  const floorIds = new Map(floorRows.map((row) => [`${row.blockId}:${row.number}`, row.id]));
  const byNumber = new Map<string, Array<(typeof existing)[number]["apartment"]>>();
  for (const { apartment, blockId } of existing) {
    const key = `${blockId}:${apartment.number}`;
    byNumber.set(key, [...(byNumber.get(key) ?? []), apartment]);
  }

  type Plan = {
    row: (typeof rows)[number];
    blockId: string;
    layoutTypeId: string;
    match: (typeof existing)[number]["apartment"] | undefined;
  };
  const plans: Plan[] = [];
  for (const row of rows) {
    const blockId = blockIds.get(row.block);
    const layoutTypeId = layoutIds.get(row.layout.toUpperCase());
    if (!blockId)
      issues.push({ line: row.line, column: "block", code: "block_unknown", value: row.block });
    if (!layoutTypeId) {
      issues.push({ line: row.line, column: "layout", code: "layout_unknown", value: row.layout });
    }
    if (!blockId || !layoutTypeId) continue;
    const matches = byNumber.get(`${blockId}:${row.number}`) ?? [];
    if (matches.length > 1) {
      issues.push({
        line: row.line,
        column: "number",
        code: "ambiguous",
        value: `${row.block}-${row.number}`,
      });
      continue;
    }
    plans.push({ row, blockId, layoutTypeId, match: matches[0] });
  }
  if (issues.length) return;

  // Floors the file names that do not exist yet.
  const missingFloors = new Map<string, { blockId: string; number: number }>();
  for (const { row, blockId } of plans) {
    const key = `${blockId}:${row.floor}`;
    if (!floorIds.has(key)) missingFloors.set(key, { blockId, number: row.floor });
  }
  if (missingFloors.size) {
    const created = await tx
      .insert(floors)
      .values([...missingFloors.values()])
      .returning();
    for (const floor of created) floorIds.set(`${floor.blockId}:${floor.number}`, floor.id);
    report.floorsCreated = created.length;
    await auditMany(
      tx,
      created.map((floor) => ({
        actorId: user.id,
        action: "floor.create",
        entityType: "floor",
        entityId: floor.id,
        after: floor,
        headers,
      })),
    );
  }

  const entries: AuditEntry[] = [];
  const takenSlugs = new Set(
    (await tx.select({ slug: apartments.slug }).from(apartments)).map((row) => row.slug),
  );
  const inserts: Array<typeof apartments.$inferInsert> = [];
  for (const { row, blockId, layoutTypeId, match } of plans) {
    const values = {
      number: row.number,
      floorId: floorIds.get(`${blockId}:${row.floor}`)!,
      layoutTypeId,
      areaTotal: row.areaTotal,
      status: row.status,
      priceMinor: row.priceMinor === null ? null : Number(row.priceMinor),
      // The owner's file is the real inventory.
      isDemo: false,
    };
    if (!match) {
      const slug = uniqueSlug(slugify(`blok ${row.block} menzil ${row.number}`), takenSlugs);
      takenSlugs.add(slug);
      inserts.push({ ...values, slug });
      continue;
    }
    const same =
      match.floorId === values.floorId &&
      match.layoutTypeId === values.layoutTypeId &&
      sameArea(match.areaTotal, values.areaTotal) &&
      match.status === values.status &&
      match.priceMinor === values.priceMinor &&
      !match.isDemo;
    if (same) {
      report.unchanged++;
      continue;
    }
    const [after] = await tx
      .update(apartments)
      .set(values)
      .where(eq(apartments.id, match.id))
      .returning();
    report.updated++;
    entries.push({
      actorId: user.id,
      action: "apartment.update",
      entityType: "apartment",
      entityId: match.id,
      before: match,
      after,
      headers,
    });
  }
  if (inserts.length) {
    const created = await tx.insert(apartments).values(inserts).returning();
    report.created = created.length;
    for (const row of created) {
      entries.push({
        actorId: user.id,
        action: "apartment.create",
        entityType: "apartment",
        entityId: row.id,
        after: row,
        headers,
      });
    }
  }

  if (input.mode === "replaceDemo") {
    const matched = new Set(plans.flatMap(({ match }) => (match ? [match.id] : [])));
    const removed = existing
      .map(({ apartment }) => apartment)
      .filter((apartment) => apartment.isDemo && !matched.has(apartment.id));
    await replaceDemo(tx, removed, report, entries, { user, headers });
  }

  await auditMany(tx, entries);
  await audit(tx, {
    actorId: user.id,
    action: "apartment.import",
    entityType: "apartment",
    after: {
      mode: input.mode,
      rows: report.rows,
      created: report.created,
      updated: report.updated,
      unchanged: report.unchanged,
      floorsCreated: report.floorsCreated,
      demo: report.demo,
    },
    headers,
  });
}

/** Removes the demo apartments the file did not name, then the demo structure left unused. */
async function replaceDemo(
  tx: Executor,
  removed: Array<typeof apartments.$inferSelect>,
  report: ImportReport,
  entries: AuditEntry[],
  { user, headers }: { user: SessionUser; headers: Headers },
): Promise<void> {
  const ids = removed.map((apartment) => apartment.id);
  if (ids.length) {
    const [linked] = await tx
      .select({ n: count() })
      .from(leads)
      .where(inArray(leads.apartmentId, ids));
    report.demo.leads = linked?.n ?? 0;
    await tx.delete(apartments).where(inArray(apartments.id, ids));
  }
  report.demo.apartments = ids.length;
  const removal = (entityType: string) => (row: { id: string }) => ({
    actorId: user.id,
    action: `${entityType}.delete`,
    entityType,
    entityId: row.id,
    before: row,
    after: null,
    headers,
  });
  entries.push(...removed.map(removal("apartment")));

  const unusedFloors = await tx
    .delete(floors)
    .where(
      and(
        eq(floors.isDemo, true),
        notExists(tx.select().from(apartments).where(eq(apartments.floorId, floors.id))),
      ),
    )
    .returning();
  const unusedBlocks = await tx
    .delete(blocks)
    .where(
      and(
        eq(blocks.isDemo, true),
        notExists(tx.select().from(floors).where(eq(floors.blockId, blocks.id))),
      ),
    )
    .returning();
  const unusedBuildings = await tx
    .delete(buildings)
    .where(
      and(
        eq(buildings.isDemo, true),
        notExists(tx.select().from(blocks).where(eq(blocks.buildingId, buildings.id))),
      ),
    )
    .returning();
  report.demo.floors = unusedFloors.length;
  report.demo.blocks = unusedBlocks.length;
  report.demo.buildings = unusedBuildings.length;
  entries.push(
    ...unusedFloors.map(removal("floor")),
    ...unusedBlocks.map(removal("block")),
    ...unusedBuildings.map(removal("building")),
  );

  // What is left of the demo structure carries real apartments now.
  const kept = [
    ...(await tx.update(floors).set({ isDemo: false }).where(eq(floors.isDemo, true)).returning()),
    ...(await tx.update(blocks).set({ isDemo: false }).where(eq(blocks.isDemo, true)).returning()),
    ...(await tx
      .update(buildings)
      .set({ isDemo: false })
      .where(eq(buildings.isDemo, true))
      .returning()),
  ];
  report.demo.kept = kept.length;
}
