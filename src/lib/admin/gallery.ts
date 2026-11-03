import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { galleryCategories, galleryItems, media } from "@/db/schema";
import { notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import type {
  AdminGallery,
  AdminGalleryCategory,
  AdminGalleryItem,
  galleryCategoryCreateSchema,
  galleryCategoryUpdateSchema,
  galleryItemCreateSchema,
  galleryItemUpdateSchema,
} from "@/shared/gallery";
import type { orderSchema } from "@/shared/ordering";

import { assertMedia, resolveSlug } from "./content";
import { toAdminMedia } from "./media";
import { assertMayPublish, assertSameMembers } from "./ordering";

type CategoryRow = typeof galleryCategories.$inferSelect;
type ItemRow = typeof galleryItems.$inferSelect;

type Write = { user: SessionUser; headers: Headers };

/** The site's order (`loadGallery`), with ties broken the same way. */
const categoryOrder = [asc(galleryCategories.sortOrder), asc(galleryCategories.slug)];
const itemOrder = [asc(galleryItems.sortOrder), asc(galleryItems.createdAt), asc(galleryItems.id)];

/** Only images for now: whether videos belong in the gallery is open on #25. */
const itemKinds = ["image"] as const;

async function previews(
  db: Executor,
  ids: string[],
): Promise<Map<string, AdminGalleryItem["media"]>> {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return new Map();
  const rows = await db.select().from(media).where(inArray(media.id, wanted));
  return new Map(
    rows.map((row) => {
      const item = toAdminMedia(row);
      return [
        row.id,
        {
          previewUrl: item.previewUrl,
          alt: row.alt?.az?.trim() || null,
          missingAlt: item.missingAlt,
        },
      ];
    }),
  );
}

function toItem(row: ItemRow, files: Map<string, AdminGalleryItem["media"]>): AdminGalleryItem {
  return {
    id: row.id,
    categoryId: row.categoryId,
    mediaId: row.mediaId,
    caption: row.caption,
    status: row.status,
    sortOrder: row.sortOrder,
    media: files.get(row.mediaId) ?? { previewUrl: null, alt: null, missingAlt: true },
  };
}

/** The whole gallery, drafts included, in the site's order. */
export async function getAdminGallery(db: Executor): Promise<AdminGallery> {
  const [categories, items] = await Promise.all([
    db
      .select()
      .from(galleryCategories)
      .orderBy(...categoryOrder),
    db
      .select()
      .from(galleryItems)
      .orderBy(...itemOrder),
  ]);
  const files = await previews(
    db,
    items.map((item) => item.mediaId),
  );
  return {
    categories: categories.map((category): AdminGalleryCategory => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      sortOrder: category.sortOrder,
      items: items
        .filter((item) => item.categoryId === category.id)
        .map((item) => toItem(item, files)),
    })),
  };
}

async function lockedCategory(db: Executor, id: string): Promise<CategoryRow> {
  const [row] = await db
    .select()
    .from(galleryCategories)
    .where(eq(galleryCategories.id, id))
    .for("update");
  if (!row) throw notFound("No such gallery category.");
  return row;
}

async function lockedItem(db: Executor, id: string): Promise<ItemRow> {
  const [row] = await db.select().from(galleryItems).where(eq(galleryItems.id, id)).for("update");
  if (!row) throw notFound("No such gallery item.");
  return row;
}

async function itemWithPreview(db: Executor, row: ItemRow): Promise<AdminGalleryItem> {
  return toItem(row, await previews(db, [row.mediaId]));
}

/** The next free position at the end of a category. */
async function nextItemPosition(db: Executor, categoryId: string): Promise<number> {
  const [last] = await db
    .select({ max: sql<number | null>`max(${galleryItems.sortOrder})` })
    .from(galleryItems)
    .where(eq(galleryItems.categoryId, categoryId));
  return (last?.max ?? -1) + 1;
}

// Categories

/** A new category, at the end. */
export async function createGalleryCategory(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof galleryCategoryCreateSchema> },
): Promise<AdminGalleryCategory> {
  const result = await db.transaction(async (tx) => {
    const slug = await resolveSlug(tx, galleryCategories, {
      requested: input.slug,
      title: input.name,
      fallback: "kateqoriya",
    });
    const [last] = await tx
      .select({ max: sql<number | null>`max(${galleryCategories.sortOrder})` })
      .from(galleryCategories);
    const [row] = await tx
      .insert(galleryCategories)
      .values({ slug, name: input.name, sortOrder: (last?.max ?? -1) + 1 })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "gallery_category.create",
      entityType: "gallery_category",
      entityId: row!.id,
      after: row,
      headers,
    });
    return { id: row!.id, slug, name: row!.name, sortOrder: row!.sortOrder, items: [] };
  });
  revalidatePublic(publicTags.content);
  return result;
}

export async function updateGalleryCategory(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: Write & { id: string; input: z.output<typeof galleryCategoryUpdateSchema> },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await lockedCategory(tx, id);
    const slug =
      input.slug === undefined
        ? undefined
        : await resolveSlug(tx, galleryCategories, {
            requested: input.slug,
            title: input.name ?? before.name,
            fallback: "kateqoriya",
            id,
          });
    const [after] = await tx
      .update(galleryCategories)
      .set({ ...input, ...(slug ? { slug } : {}) })
      .where(eq(galleryCategories.id, id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "gallery_category.update",
      entityType: "gallery_category",
      entityId: id,
      before,
      after,
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}

/** Removes a category and its items; their files stay in the library. */
export async function deleteGalleryCategory(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await lockedCategory(tx, id);
    const items = await tx
      .select({ id: galleryItems.id, mediaId: galleryItems.mediaId })
      .from(galleryItems)
      .where(eq(galleryItems.categoryId, id));
    await tx.delete(galleryCategories).where(eq(galleryCategories.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "gallery_category.delete",
      entityType: "gallery_category",
      entityId: id,
      before: { ...before, items },
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}

/** Puts every category in the given order: the order of the site's filter. */
export async function reorderGalleryCategories(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof orderSchema> },
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: galleryCategories.id, sortOrder: galleryCategories.sortOrder })
      .from(galleryCategories)
      .orderBy(...categoryOrder)
      .for("update");
    assertSameMembers(
      rows.map((row) => row.id),
      input.ids,
    );
    for (const [index, id] of input.ids.entries()) {
      if (rows.find((row) => row.id === id)!.sortOrder !== index) {
        await tx
          .update(galleryCategories)
          .set({ sortOrder: index })
          .where(eq(galleryCategories.id, id));
      }
    }
    await audit(tx, {
      actorId: user.id,
      action: "gallery_category.reorder",
      entityType: "gallery_category",
      before: { order: rows.map((row) => row.id) },
      after: { order: input.ids },
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}

/** Puts every item of one category in the given order. */
export async function reorderGalleryItems(
  db: Executor,
  {
    categoryId,
    input,
    user,
    headers,
  }: Write & { categoryId: string; input: z.output<typeof orderSchema> },
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockedCategory(tx, categoryId);
    const rows = await tx
      .select({ id: galleryItems.id, sortOrder: galleryItems.sortOrder })
      .from(galleryItems)
      .where(eq(galleryItems.categoryId, categoryId))
      .orderBy(...itemOrder)
      .for("update");
    assertSameMembers(
      rows.map((row) => row.id),
      input.ids,
    );
    for (const [index, id] of input.ids.entries()) {
      if (rows.find((row) => row.id === id)!.sortOrder !== index) {
        await tx.update(galleryItems).set({ sortOrder: index }).where(eq(galleryItems.id, id));
      }
    }
    await audit(tx, {
      actorId: user.id,
      action: "gallery_item.reorder",
      entityType: "gallery_category",
      entityId: categoryId,
      before: { order: rows.map((row) => row.id) },
      after: { order: input.ids },
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}

// Items

/** A library image added to the end of a category. */
export async function createGalleryItem(
  db: Executor,
  { input, user, headers }: Write & { input: z.output<typeof galleryItemCreateSchema> },
): Promise<AdminGalleryItem> {
  if (input.status === "published") assertMayPublish(user);
  const result = await db.transaction(async (tx) => {
    await lockedCategory(tx, input.categoryId);
    await assertMedia(tx, [input.mediaId], itemKinds, "mediaId");
    const [row] = await tx
      .insert(galleryItems)
      .values({
        categoryId: input.categoryId,
        mediaId: input.mediaId,
        caption: input.caption ?? null,
        status: input.status,
        sortOrder: await nextItemPosition(tx, input.categoryId),
      })
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "gallery_item.create",
      entityType: "gallery_item",
      entityId: row!.id,
      after: row,
      headers,
    });
    return itemWithPreview(tx, row!);
  });
  revalidatePublic(publicTags.content);
  return result;
}

export async function updateGalleryItem(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: Write & { id: string; input: z.output<typeof galleryItemUpdateSchema> },
): Promise<AdminGalleryItem> {
  const result = await db.transaction(async (tx) => {
    const before = await lockedItem(tx, id);
    if (input.status && input.status !== before.status) assertMayPublish(user);
    if (input.mediaId) await assertMedia(tx, [input.mediaId], itemKinds, "mediaId");
    const moving = input.categoryId !== undefined && input.categoryId !== before.categoryId;
    if (moving) await lockedCategory(tx, input.categoryId!);
    const [after] = await tx
      .update(galleryItems)
      .set({
        ...input,
        ...(moving ? { sortOrder: await nextItemPosition(tx, input.categoryId!) } : {}),
      })
      .where(eq(galleryItems.id, id))
      .returning();
    await audit(tx, {
      actorId: user.id,
      action: "gallery_item.update",
      entityType: "gallery_item",
      entityId: id,
      before,
      after,
      headers,
    });
    return itemWithPreview(tx, after!);
  });
  revalidatePublic(publicTags.content);
  return result;
}

/** Removes an item from the gallery; its file stays in the library. */
export async function deleteGalleryItem(
  db: Executor,
  { id, user, headers }: Write & { id: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await lockedItem(tx, id);
    await tx.delete(galleryItems).where(eq(galleryItems.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "gallery_item.delete",
      entityType: "gallery_item",
      entityId: id,
      before,
      headers,
    });
  });
  revalidatePublic(publicTags.content);
}
