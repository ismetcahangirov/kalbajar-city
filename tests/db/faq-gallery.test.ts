import { randomUUID } from "node:crypto";

import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, faq, galleryCategories, media } from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";
import type { AdminFaq } from "@/shared/faq";
import type { AdminGallery, AdminGalleryCategory, AdminGalleryItem } from "@/shared/gallery";

import { createUser, origin, type TestUser } from "./accounts";

// Outside Next, "use cache" is inert; the cache calls are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as Array<[string, unknown]> }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string, profile: unknown) => void cache.revalidated.push([tag, profile]),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

vi.stubEnv("S3_PUBLIC_URL", "http://localhost:9010/test");

const faqListRoute = await import("@/app/api/v1/admin/faq/route");
const faqRoute = await import("@/app/api/v1/admin/faq/[id]/route");
const faqOrderRoute = await import("@/app/api/v1/admin/faq/order/route");
const galleryRoute = await import("@/app/api/v1/admin/gallery/route");
const categoriesRoute = await import("@/app/api/v1/admin/gallery/categories/route");
const categoryRoute = await import("@/app/api/v1/admin/gallery/categories/[id]/route");
const categoriesOrderRoute = await import("@/app/api/v1/admin/gallery/categories/order/route");
const itemsOrderRoute =
  await import("@/app/api/v1/admin/gallery/categories/[id]/items/order/route");
const itemsRoute = await import("@/app/api/v1/admin/gallery/items/route");
const itemRoute = await import("@/app/api/v1/admin/gallery/items/[id]/route");
const { loadPublishedFaq } = await import("@/lib/public/home");
const { loadGallery } = await import("@/lib/public/gallery");
const { faqNode } = await import("@/lib/seo/json-ld");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const tag = randomUUID().slice(0, 6);
const people = {} as Record<UserRole, TestUser>;
const createdMedia: string[] = [];
const createdFaq: string[] = [];

beforeAll(async () => {
  for (const role of ["editor", "sales"] as const) people[role] = await createUser(role);
});

// Other files count rows from an empty database (the seed skips a filled FAQ).
afterAll(async () => {
  if (createdFaq.length) await db.delete(faq).where(inArray(faq.id, createdFaq));
  await db.delete(galleryCategories).where(like(galleryCategories.slug, `t-${tag}-%`));
  if (createdMedia.length) await db.delete(media).where(inArray(media.id, createdMedia));
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

type Init = { method?: string; body?: unknown; role?: UserRole | null };

function request(path: string, { method, body, role = "editor" }: Init = {}): Request {
  const headers = new Headers({ "user-agent": "vitest" });
  if (role) headers.set("cookie", people[role].cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });
const none = { params: Promise.resolve({}) };

type ErrorBody = { error: { code: string; fields?: Record<string, string[]> } };

async function file(values: Partial<typeof media.$inferInsert> = {}) {
  const [row] = await db
    .insert(media)
    .values({
      key: `test/${tag}/${randomUUID()}.jpg`,
      kind: "image",
      mimeType: "image/jpeg",
      size: 10,
      width: 1200,
      height: 800,
      alt: { az: "Lobbi", en: "Lobby" },
      variants: [],
      ...values,
    })
    .returning();
  createdMedia.push(row!.id);
  return row!;
}

async function auditOf(action: string, entityId?: string) {
  return db
    .select()
    .from(auditLog)
    .where(
      entityId
        ? and(eq(auditLog.action, action), eq(auditLog.entityId, entityId))
        : eq(auditLog.action, action),
    );
}

async function createFaq(question: string, extra: Record<string, unknown> = {}) {
  const response = await faqListRoute.POST(
    request("/admin/faq", {
      body: { question: { az: question }, answer: { az: `${question} cavab` }, ...extra },
    }),
    none,
  );
  expect(response.status).toBe(201);
  const item = (await response.json()) as AdminFaq;
  createdFaq.push(item.id);
  return item;
}

async function listFaq() {
  return (await (await faqListRoute.GET(request("/admin/faq"), none)).json()) as AdminFaq[];
}

describe("faq", () => {
  it("creates questions at the end, audited, and revalidates the public pages", async () => {
    const first = await createFaq(`Birinci ${tag}`);
    const second = await createFaq(`İkinci ${tag}`);
    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
    expect(cache.revalidated).toContainEqual(["content", { expire: 0 }]);
    const [entry] = await auditOf("faq.create", first.id);
    expect(entry).toMatchObject({ actorId: people.editor.id, before: null });
  });

  it("reorders: the site and the FAQPage structured data follow", async () => {
    await createFaq(`Üçüncü ${tag}`);
    const before = await listFaq();
    const ids = before.map((item) => item.id).reverse();
    cache.revalidated.length = 0;

    const response = await faqOrderRoute.PUT(
      request("/admin/faq/order", { method: "PUT", body: { ids } }),
      none,
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as AdminFaq[]).map((item) => item.id)).toEqual(ids);
    expect(cache.revalidated).toEqual([["content", { expire: 0 }]]);

    const site = await loadPublishedFaq(db);
    expect(site.map((row) => row.id)).toEqual(ids);
    const node = faqNode(site.map((row) => ({ question: row.question.az, answer: row.answer.az })));
    const names = (node.mainEntity as Array<{ name: string }>).map((entry) => entry.name);
    expect(names).toEqual(site.map((row) => row.question.az));

    const [entry] = await auditOf("faq.reorder");
    expect(entry?.after).toEqual({ order: ids });
  });

  it("refuses a reorder from a stale list", async () => {
    const current = await listFaq();
    const response = await faqOrderRoute.PUT(
      request("/admin/faq/order", {
        method: "PUT",
        body: { ids: current.slice(1).map((item) => item.id) },
      }),
      none,
    );
    expect(response.status).toBe(422);
    expect(((await response.json()) as ErrorBody).error.fields).toHaveProperty("ids");
  });

  it("edits, hides and deletes a question", async () => {
    const item = await createFaq(`Dördüncü ${tag}`);
    const edited = await faqRoute.PATCH(
      request(`/admin/faq/${item.id}`, {
        method: "PATCH",
        body: { answer: { az: "Yeni cavab", en: "New answer" }, status: "draft" },
      }),
      context(item.id),
    );
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ status: "draft", answer: { en: "New answer" } });
    expect((await loadPublishedFaq(db)).map((row) => row.id)).not.toContain(item.id);

    const removed = await faqRoute.DELETE(
      request(`/admin/faq/${item.id}`, { method: "DELETE" }),
      context(item.id),
    );
    expect(removed.status).toBe(204);
    expect(await auditOf("faq.delete", item.id)).toHaveLength(1);
  });

  it("is closed to sales", async () => {
    const response = await faqListRoute.GET(request("/admin/faq", { role: "sales" }), none);
    expect(response.status).toBe(403);
  });
});

async function createCategory(name: string, slug?: string) {
  const response = await categoriesRoute.POST(
    request("/admin/gallery/categories", { body: { name: { az: name }, slug } }),
    none,
  );
  expect(response.status).toBe(201);
  return (await response.json()) as AdminGalleryCategory;
}

async function addItem(categoryId: string, mediaId: string, extra: Record<string, unknown> = {}) {
  return itemsRoute.POST(
    request("/admin/gallery/items", { body: { categoryId, mediaId, ...extra } }),
    none,
  );
}

async function gallery() {
  return (await (await galleryRoute.GET(request("/admin/gallery"), none)).json()) as AdminGallery;
}

describe("gallery", () => {
  it("adds library images to categories, reorders both, and the site follows", async () => {
    const exterior = await createCategory("Eksteryer", `t-${tag}-a`);
    const interior = await createCategory("İnteryer", `t-${tag}-b`);
    const photos = [await file(), await file(), await file()];
    const items: AdminGalleryItem[] = [];
    for (const photo of photos) {
      const response = await addItem(interior.id, photo.id);
      expect(response.status).toBe(201);
      items.push((await response.json()) as AdminGalleryItem);
    }
    expect(items.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
    expect(await auditOf("gallery_item.create", items[0]!.id)).toHaveLength(1);

    const order = [items[2]!.id, items[0]!.id, items[1]!.id];
    const reordered = await itemsOrderRoute.PUT(
      request(`/admin/gallery/categories/${interior.id}/items/order`, {
        method: "PUT",
        body: { ids: order },
      }),
      context(interior.id),
    );
    expect(reordered.status).toBe(204);
    expect(cache.revalidated).toContainEqual(["content", { expire: 0 }]);

    const all = (await gallery()).categories.map((category) => category.id);
    const categoryOrder = [interior.id, ...all.filter((id) => id !== interior.id)];
    const categoriesMoved = await categoriesOrderRoute.PUT(
      request("/admin/gallery/categories/order", { method: "PUT", body: { ids: categoryOrder } }),
      none,
    );
    expect(categoriesMoved.status).toBe(204);

    const site = await loadGallery(db, "az");
    expect(site.categories.map((category) => category.slug).slice(0, 1)).toEqual([`t-${tag}-b`]);
    expect(
      site.items.filter((item) => item.category === `t-${tag}-b`).map((item) => item.id),
    ).toEqual(order);
    // An empty category is left off the site.
    expect(site.categories.map((category) => category.slug)).not.toContain(exterior.slug);
  });

  it("accepts images only, and only from the library", async () => {
    const category = await createCategory("Video", `t-${tag}-c`);
    const video = await file({ kind: "video", mimeType: "video/mp4", width: 1920, height: 1080 });
    const refused = await addItem(category.id, video.id);
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as ErrorBody).error.fields).toHaveProperty("mediaId");
    expect((await addItem(category.id, randomUUID())).status).toBe(422);
  });

  it("moves an item to the end of another category and hides it", async () => {
    const from = await createCategory("Bir", `t-${tag}-d`);
    const to = await createCategory("İki", `t-${tag}-e`);
    await addItem(to.id, (await file()).id);
    const item = (await (await addItem(from.id, (await file()).id)).json()) as AdminGalleryItem;

    const response = await itemRoute.PATCH(
      request(`/admin/gallery/items/${item.id}`, {
        method: "PATCH",
        body: { categoryId: to.id, caption: { az: "Həyət" }, status: "draft" },
      }),
      context(item.id),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      categoryId: to.id,
      sortOrder: 1,
      status: "draft",
      caption: { az: "Həyət" },
    });
    const site = await loadGallery(db, "az");
    expect(site.items.map((entry) => entry.id)).not.toContain(item.id);
  });

  it("renames a category and deletes it with its items, keeping the files", async () => {
    const category = await createCategory("Köhnə", `t-${tag}-f`);
    const photo = await file();
    await addItem(category.id, photo.id);
    const renamed = await categoryRoute.PATCH(
      request(`/admin/gallery/categories/${category.id}`, {
        method: "PATCH",
        body: { name: { az: "Yeni", en: "New" } },
      }),
      context(category.id),
    );
    expect(renamed.status).toBe(204);
    const removed = await categoryRoute.DELETE(
      request(`/admin/gallery/categories/${category.id}`, { method: "DELETE" }),
      context(category.id),
    );
    expect(removed.status).toBe(204);
    expect((await gallery()).categories.map((entry) => entry.id)).not.toContain(category.id);
    expect(await db.select().from(media).where(eq(media.id, photo.id))).toHaveLength(1);
    expect(await auditOf("gallery_category.delete", category.id)).toHaveLength(1);
  });

  it("makes a slug from the Azerbaijani name when none is given", async () => {
    const category = await createCategory(`T ${tag} Gecə görünüşü`);
    // Cleaned up by the `t-<tag>-` prefix.
    expect(category.slug).toBe(`t-${tag}-gece-gorunusu`);
  });
});
