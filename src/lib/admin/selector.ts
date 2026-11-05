import "server-only";

import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { apartments, blocks, floors, media, selectorViews } from "@/db/schema";
import { invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { mediaUrl } from "@/lib/public/media";
import type {
  AdminSelectorHotspot,
  AdminSelectorPicture,
  AdminSelectorView,
  SelectorLevel,
  SelectorViewQuery,
  selectorHotspotSchema,
  selectorPictureSchema,
} from "@/shared/selector";

import { assertMedia } from "./content";

/**
 * The complex selector's polygon editor (#19): the picture of each level and
 * the hotspots drawn on it. Writes are audited in their transaction and
 * revalidate the public pages' `inventory` tag, which `/kompleks` reads.
 */

type Write = { user: SessionUser; headers: Headers };

type MediaRow = typeof media.$inferSelect;

/** The editor draws on a WebP of at most this width: sharp enough to click on, light to load. */
const editorWidth = 1600;

function toPicture(row: MediaRow): AdminSelectorPicture {
  const webp = row.variants
    .filter((variant) => variant.format === "webp")
    .sort((a, b) => a.width - b.width);
  const large = webp.filter((variant) => variant.width <= editorWidth).at(-1) ?? webp[0];
  return {
    id: row.id,
    url: large ? mediaUrl(large.key) : null,
    previewUrl: webp[0] ? mediaUrl(webp[0].key) : null,
    width: row.width,
    height: row.height,
    alt: row.alt?.az?.trim() || null,
    missingAlt: !row.decorative && !row.alt?.az?.trim(),
  };
}

async function pictureOf(db: Executor, id: string | null): Promise<AdminSelectorPicture | null> {
  if (!id) return null;
  const [row] = await db.select().from(media).where(eq(media.id, id));
  return row ? toPicture(row) : null;
}

async function blockExists(db: Executor, id: string): Promise<void> {
  const [row] = await db.select({ id: blocks.id }).from(blocks).where(eq(blocks.id, id));
  if (!row) throw notFound("No such block.");
}

/** The site, a block's facade, or a floor's plan, with the hotspots drawn on it. */
export async function getSelectorView(
  db: Executor,
  query: SelectorViewQuery,
): Promise<AdminSelectorView> {
  if (query.floor) {
    const [floor] = await db.select().from(floors).where(eq(floors.id, query.floor));
    if (!floor || (query.block && floor.blockId !== query.block)) throw notFound("No such floor.");
    const rows = await db
      .select({
        id: apartments.id,
        number: apartments.number,
        polygon: apartments.planPolygon,
        status: apartments.status,
      })
      .from(apartments)
      .where(eq(apartments.floorId, floor.id))
      .orderBy(asc(sql`length(${apartments.number})`), asc(apartments.number));
    return {
      level: "floor",
      id: floor.id,
      picture: await pictureOf(db, floor.planMediaId),
      hotspots: rows.map((row) => ({
        id: row.id,
        label: row.number,
        polygon: row.polygon,
        status: row.status,
      })),
    };
  }

  if (query.block) {
    await blockExists(db, query.block);
    const [view] = await db
      .select({ mediaId: selectorViews.mediaId })
      .from(selectorViews)
      .where(eq(selectorViews.blockId, query.block));
    const rows = await db
      .select({ id: floors.id, number: floors.number, polygon: floors.facadePolygon })
      .from(floors)
      .where(eq(floors.blockId, query.block))
      .orderBy(desc(floors.number));
    return {
      level: "block",
      id: query.block,
      picture: await pictureOf(db, view?.mediaId ?? null),
      hotspots: rows.map((row) => ({
        id: row.id,
        label: String(row.number),
        polygon: row.polygon,
        status: null,
      })),
    };
  }

  const [view] = await db
    .select({ mediaId: selectorViews.mediaId })
    .from(selectorViews)
    .where(isNull(selectorViews.blockId));
  const rows = await db
    .select({ id: blocks.id, code: blocks.code, polygon: blocks.sitePolygon })
    .from(blocks)
    .orderBy(asc(blocks.sortOrder), asc(blocks.code));
  return {
    level: "site",
    id: null,
    picture: await pictureOf(db, view?.mediaId ?? null),
    hotspots: rows.map((row) => ({
      id: row.id,
      label: row.code,
      polygon: row.polygon,
      status: null,
    })),
  };
}

const queryOf = async (
  db: Executor,
  level: SelectorLevel,
  id: string | null,
): Promise<SelectorViewQuery> => {
  if (level === "site" || !id) return {};
  if (level === "block") return { block: id };
  const [floor] = await db
    .select({ blockId: floors.blockId })
    .from(floors)
    .where(eq(floors.id, id));
  return { block: floor?.blockId, floor: id };
};

/**
 * Sets or clears a level's picture. The hotspots drawn on the old picture
 * are kept: they are normalised, so a sharper copy of the same render keeps
 * them in place; staff redraw them when the picture is a different one.
 */
export async function setSelectorPicture(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof selectorPictureSchema> },
): Promise<AdminSelectorView> {
  const { level, id, mediaId } = input;
  if (level !== "site" && !id) throw invalidField("id", "Choose a block or a floor.");
  if (level === "site" && id) throw invalidField("id", "The site has no id.");

  await db.transaction(async (tx) => {
    if (mediaId) await assertMedia(tx, [mediaId], ["image"], "mediaId");

    if (level === "floor") {
      const [before] = await tx.select().from(floors).where(eq(floors.id, id!)).for("update");
      if (!before) throw notFound("No such floor.");
      const [after] = await tx
        .update(floors)
        .set({ planMediaId: mediaId })
        .where(eq(floors.id, id!))
        .returning();
      await audit(tx, {
        actorId: user.id,
        action: "floor.update",
        entityType: "floor",
        entityId: id,
        before,
        after,
        headers,
      });
      return;
    }

    if (level === "block") await blockExists(tx, id!);
    const where =
      level === "block" ? eq(selectorViews.blockId, id!) : isNull(selectorViews.blockId);
    let [before] = await tx.select().from(selectorViews).where(where).for("update");
    let after: typeof before | null = null;
    if (!before && mediaId) {
      // Two first saves race on the unique index (the site's is partial, so
      // no conflict target can name it): the later one waits for the earlier
      // one's row, then updates it.
      [after] = await tx
        .insert(selectorViews)
        .values({ blockId: level === "block" ? id : null, mediaId })
        .onConflictDoNothing()
        .returning();
      if (!after) [before] = await tx.select().from(selectorViews).where(where).for("update");
    }
    if (!mediaId) {
      if (before) await tx.delete(selectorViews).where(eq(selectorViews.id, before.id));
    } else if (before) {
      [after] = await tx
        .update(selectorViews)
        .set({ mediaId })
        .where(eq(selectorViews.id, before.id))
        .returning();
    }
    if (before || after) {
      await audit(tx, {
        actorId: user.id,
        action: !before
          ? "selector_view.create"
          : after
            ? "selector_view.update"
            : "selector_view.delete",
        entityType: "selector_view",
        entityId: (after ?? before)!.id,
        before: before ?? null,
        after: after ?? null,
        headers,
      });
    }
  });
  revalidatePublic(publicTags.inventory);
  return getSelectorView(db, await queryOf(db, level, id));
}

/** Draws (or, with `null`, clears) one item's hotspot on its level's picture. */
export async function setSelectorHotspot(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof selectorHotspotSchema> },
): Promise<AdminSelectorHotspot> {
  const { level, id, polygon } = input;
  const result = await db.transaction(async (tx): Promise<AdminSelectorHotspot> => {
    const log = (entityType: string, before: object, after: object | undefined) =>
      audit(tx, {
        actorId: user.id,
        action: `${entityType}.hotspot`,
        entityType,
        entityId: id,
        before: before as Record<string, unknown>,
        after: (after ?? null) as Record<string, unknown> | null,
        headers,
      });

    if (level === "site") {
      const [before] = await tx.select().from(blocks).where(eq(blocks.id, id)).for("update");
      if (!before) throw notFound("No such block.");
      const [after] = await tx
        .update(blocks)
        .set({ sitePolygon: polygon })
        .where(eq(blocks.id, id))
        .returning();
      await log("block", before, after);
      return { id, label: before.code, polygon, status: null };
    }
    if (level === "block") {
      const [before] = await tx.select().from(floors).where(eq(floors.id, id)).for("update");
      if (!before) throw notFound("No such floor.");
      const [after] = await tx
        .update(floors)
        .set({ facadePolygon: polygon })
        .where(eq(floors.id, id))
        .returning();
      await log("floor", before, after);
      return { id, label: String(before.number), polygon, status: null };
    }
    const [before] = await tx.select().from(apartments).where(eq(apartments.id, id)).for("update");
    if (!before) throw notFound("No such apartment.");
    const [after] = await tx
      .update(apartments)
      .set({ planPolygon: polygon })
      .where(eq(apartments.id, id))
      .returning();
    await log("apartment", before, after);
    return { id, label: before.number, polygon, status: before.status };
  });
  revalidatePublic(publicTags.inventory);
  return result;
}
