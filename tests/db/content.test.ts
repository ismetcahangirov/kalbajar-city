import { randomUUID } from "node:crypto";

import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import {
  auditLog,
  constructionUpdates,
  galleryCategories,
  galleryItems,
  media,
  mediaUsages,
  news,
} from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";
import { mediaUsages as usagesOf } from "@/lib/media/usages";
import type { AdminConstructionUpdate, AdminNews } from "@/shared/content";
import { paragraphs, type RichTextDoc } from "@/shared/rich-text";

import { createUser, origin, type TestUser } from "./accounts";

// Outside Next, "use cache" is inert; the cache calls are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as Array<[string, unknown]> }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string, profile: unknown) => void cache.revalidated.push([tag, profile]),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

// toPublicImage needs the bucket's public origin; the files themselves are not fetched.
vi.stubEnv("S3_PUBLIC_URL", "http://localhost:9010/test");

const updatesRoute = await import("@/app/api/v1/admin/construction-updates/route");
const updateRoute = await import("@/app/api/v1/admin/construction-updates/[id]/route");
const updateMediaRoute = await import("@/app/api/v1/admin/construction-updates/[id]/media/route");
const updatePublicationRoute =
  await import("@/app/api/v1/admin/construction-updates/[id]/publication/route");
const newsListRoute = await import("@/app/api/v1/admin/news/route");
const newsRoute = await import("@/app/api/v1/admin/news/[id]/route");
const newsPublicationRoute = await import("@/app/api/v1/admin/news/[id]/publication/route");
const scheduledRoute = await import("@/app/api/v1/internal/scheduled-publications/route");
const { publishScheduled } = await import("@/lib/admin/scheduled");
const { loadConstructionTimeline } = await import("@/lib/public/construction");
const { loadGallery } = await import("@/lib/public/gallery");
const { loadNewsArticle, loadNewsPage } = await import("@/lib/public/news");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const tag = randomUUID().slice(0, 6);
const people = {} as Record<UserRole, TestUser>;
const createdMedia: string[] = [];

beforeAll(async () => {
  for (const role of ["editor", "sales"] as const) people[role] = await createUser(role);
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(mediaUsages).where(inArray(mediaUsages.mediaId, createdMedia));
  await db.delete(news).where(like(news.slug, `%${tag}%`));
  await db.delete(constructionUpdates);
  await db.delete(galleryCategories).where(like(galleryCategories.slug, `t-${tag}-%`));
  await db.delete(media).where(inArray(media.id, createdMedia));
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

type ErrorBody = { error: { code: string; fields?: Record<string, string[]> } };

/** A library row without stored files. */
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
      alt: { az: "Tikinti meydançası", en: "Construction site" },
      variants: [],
      ...values,
    })
    .returning();
  createdMedia.push(row!.id);
  return row!;
}

let nextMonth = 0;
/** A month no other test in this run uses (the column is unique). */
function month(): string {
  nextMonth++;
  return `${2040 + Math.floor(nextMonth / 12)}-${String((nextMonth % 12) + 1).padStart(2, "0")}`;
}

async function createUpdate(body: Record<string, unknown>, role: UserRole = "editor") {
  return updatesRoute.POST(
    request("/admin/construction-updates", {
      role,
      body: { month: month(), title: { az: "Yanvar" }, progressPercent: 10, ...body },
    }),
  );
}

async function publishUpdate(
  id: string,
  body: Record<string, unknown> = {},
  role: UserRole = "editor",
) {
  return updatePublicationRoute.PUT(
    request(`/admin/construction-updates/${id}/publication`, { method: "PUT", body, role }),
    context(id),
  );
}

async function auditOf(entityId: string, action: string) {
  return db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityId, entityId), eq(auditLog.action, action)));
}

describe("construction updates", () => {
  it("creates a draft with its media, audited, that no public page shows", async () => {
    const photo = await file();
    const video = await file({ kind: "video", mimeType: "video/mp4", width: 1920, height: 1080 });
    const response = await createUpdate({
      title: { az: "Karkas işləri", en: "Frame works" },
      body: { az: paragraphs("Beşinci mərtəbə tamamlandı.") },
      progressPercent: 35,
      mediaIds: [photo.id, video.id],
    });
    expect(response.status).toBe(201);
    const update = (await response.json()) as AdminConstructionUpdate;
    expect(update).toMatchObject({
      slug: "karkas-isleri",
      status: "draft",
      publishedAt: null,
      progressPercent: 35,
      mediaIds: [photo.id, video.id],
    });
    expect(update.month).toMatch(/^\d{4}-\d{2}-01$/);
    expect(cache.revalidated).toEqual([["content", { expire: 0 }]]);
    const [entry] = await auditOf(update.id, "construction_update.create");
    expect(entry).toMatchObject({ actorId: people.editor.id, before: null });
    expect(entry?.after).toMatchObject({ mediaIds: [photo.id, video.id] });

    const timeline = await loadConstructionTimeline(db, "en");
    expect(timeline.map((item) => item.id)).not.toContain(update.id);

    // The library sees the update as a usage of both files.
    expect((await usagesOf(db, photo.id)).map((usage) => usage.entityId)).toEqual([update.id]);
  });

  it("publishes an update: it is public on the next read, with its media in order", async () => {
    const photo = await file({ caption: { az: "Şimal fasadı" } });
    const second = await file();
    const hidden = await file({ alt: null });
    const video = await file({
      kind: "video",
      mimeType: "video/mp4",
      key: `media/${randomUUID()}/video.mp4`,
      width: 1920,
      height: 1080,
      alt: null,
    });
    const created = (await (
      await createUpdate({
        title: { az: "Dam örtüyü", en: "Roofing" },
        progressPercent: 60,
        mediaIds: [photo.id, hidden.id, video.id],
      })
    ).json()) as AdminConstructionUpdate;

    const published = await publishUpdate(created.id);
    expect(published.status).toBe(200);
    const body = (await published.json()) as AdminConstructionUpdate;
    expect(body.status).toBe("published");
    expect(Date.now() - Date.parse(body.publishedAt!)).toBeLessThan(60_000);
    expect(await auditOf(created.id, "construction_update.publish")).toHaveLength(1);

    const reorder = await updateMediaRoute.PUT(
      request(`/admin/construction-updates/${created.id}/media`, {
        method: "PUT",
        body: { mediaIds: [video.id, second.id, photo.id, hidden.id] },
      }),
      context(created.id),
    );
    expect(reorder.status).toBe(200);
    expect(((await reorder.json()) as AdminConstructionUpdate).mediaIds).toEqual([
      video.id,
      second.id,
      photo.id,
      hidden.id,
    ]);
    const [mediaEntry] = await auditOf(created.id, "construction_update.media");
    expect(mediaEntry?.before).toEqual({ mediaIds: [photo.id, hidden.id, video.id] });

    const entry = (await loadConstructionTimeline(db, "en")).find((item) => item.id === created.id);
    expect(entry).toMatchObject({
      title: { value: "Roofing", fallback: false },
      progressPercent: 60,
    });
    // The image without alt text is never public; the video needs none.
    expect(entry?.media.map((item) => [item.kind, item.id])).toEqual([
      ["video", video.id],
      ["image", second.id],
      ["image", photo.id],
    ]);
    const shown = entry?.media.find((item) => item.id === photo.id);
    expect(shown).toMatchObject({ caption: { value: "Şimal fasadı", fallback: true } });
    const player = entry?.media[0];
    expect(player?.kind === "video" && player.video).toMatchObject({ width: 1920, height: 1080 });
  });

  it("keeps the first publication date through an unpublish and republish", async () => {
    const created = (await (await createUpdate({})).json()) as AdminConstructionUpdate;
    const first = (await (
      await publishUpdate(created.id, {
        publishedAt: "2026-10-01T09:00:00+04:00",
      })
    ).json()) as AdminConstructionUpdate;
    expect(first.publishedAt).toBe("2026-10-01T05:00:00.000Z");

    const withdrawn = await updatePublicationRoute.DELETE(
      request(`/admin/construction-updates/${created.id}/publication`, { method: "DELETE" }),
      context(created.id),
    );
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.json()).toMatchObject({
      status: "draft",
      publishedAt: "2026-10-01T05:00:00.000Z",
    });
    expect((await loadConstructionTimeline(db, "az")).map((item) => item.id)).not.toContain(
      created.id,
    );
    expect(await auditOf(created.id, "construction_update.unpublish")).toHaveLength(1);

    const again = (await (await publishUpdate(created.id)).json()) as AdminConstructionUpdate;
    expect(again.publishedAt).toBe("2026-10-01T05:00:00.000Z");
  });

  it("schedules on a future date, refuses a second update for a month and unknown files", async () => {
    const created = (await (await createUpdate({})).json()) as AdminConstructionUpdate;
    const at = new Date(Date.now() + 86_400_000).toISOString();
    const future = await publishUpdate(created.id, { publishedAt: at });
    expect(future.status).toBe(200);
    expect(await future.json()).toMatchObject({
      status: "draft",
      state: "scheduled",
      scheduledAt: at,
      publishedAt: null,
    });
    expect(await auditOf(created.id, "construction_update.schedule")).toHaveLength(1);
    const timeline = await loadConstructionTimeline(db, "az");
    expect(JSON.stringify(timeline)).not.toContain(created.slug);

    const same = await updatesRoute.POST(
      request("/admin/construction-updates", {
        body: { month: created.month, title: { az: "Təkrar" }, progressPercent: 5 },
      }),
    );
    expect(same.status).toBe(422);
    expect(((await same.json()) as ErrorBody).error.fields).toHaveProperty("month");

    const unknown = await createUpdate({ mediaIds: [randomUUID()] });
    expect(unknown.status).toBe(422);
    expect(((await unknown.json()) as ErrorBody).error.fields).toHaveProperty("mediaIds");

    const invalid = await createUpdate({ progressPercent: 140 });
    expect(invalid.status).toBe(422);

    const patched = await updateRoute.PATCH(
      request(`/admin/construction-updates/${created.id}`, {
        method: "PATCH",
        body: { progressPercent: 55, slug: "yeni-slug" },
      }),
      context(created.id),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ progressPercent: 55, slug: "yeni-slug" });
    const [entry] = await auditOf(created.id, "construction_update.update");
    expect(entry).toMatchObject({
      before: { progressPercent: 10, slug: created.slug },
      after: { progressPercent: 55, slug: "yeni-slug" },
    });
  });

  it("lets only content roles write, and deletes with an audit entry", async () => {
    expect((await createUpdate({}, "sales")).status).toBe(403);
    const anonymous = await updatesRoute.POST(
      request("/admin/construction-updates", {
        role: null,
        body: { month: month(), title: { az: "X" }, progressPercent: 1 },
      }),
    );
    expect(anonymous.status).toBe(401);
    const list = await updatesRoute.GET(request("/admin/construction-updates", { role: "sales" }));
    expect(list.status).toBe(403);

    const created = (await (await createUpdate({})).json()) as AdminConstructionUpdate;
    expect((await publishUpdate(created.id, {}, "sales")).status).toBe(403);
    const removed = await updateRoute.DELETE(
      request(`/admin/construction-updates/${created.id}`, { method: "DELETE", role: "sales" }),
      context(created.id),
    );
    expect(removed.status).toBe(403);

    const deleted = await updateRoute.DELETE(
      request(`/admin/construction-updates/${created.id}`, { method: "DELETE" }),
      context(created.id),
    );
    expect(deleted.status).toBe(204);
    expect(
      await db.select().from(constructionUpdates).where(eq(constructionUpdates.id, created.id)),
    ).toEqual([]);
    expect(await auditOf(created.id, "construction_update.delete")).toHaveLength(1);
    const missing = await updateRoute.GET(
      request(`/admin/construction-updates/${created.id}`),
      context(created.id),
    );
    expect(missing.status).toBe(404);
  });
});

const article = (text: string, extra: Record<string, unknown> = {}) => ({
  title: { az: `Test ${tag}` },
  body: { az: paragraphs(text) },
  ...extra,
});

async function createArticle(body: Record<string, unknown>) {
  const response = await newsListRoute.POST(request("/admin/news", { body }));
  expect(response.status).toBe(201);
  return (await response.json()) as AdminNews;
}

async function publishArticle(id: string, body: Record<string, unknown> = {}) {
  return newsPublicationRoute.PUT(
    request(`/admin/news/${id}/publication`, { method: "PUT", body }),
    context(id),
  );
}

describe("news", () => {
  it("makes Azerbaijani slugs from the title, unique", async () => {
    const first = await createArticle({
      ...article("Mətn"),
      title: { az: `Tikintiyə başladıq ${tag}` },
    });
    expect(first.slug).toBe(`tikintiye-basladiq-${tag}`);
    const second = await createArticle({
      ...article("Mətn"),
      title: { az: `Tikintiyə başladıq ${tag}` },
    });
    expect(second.slug).toBe(`tikintiye-basladiq-${tag}-2`);
    const taken = await newsListRoute.POST(
      request("/admin/news", { body: { ...article("Mətn"), slug: first.slug } }),
    );
    expect(taken.status).toBe(422);
    expect(((await taken.json()) as ErrorBody).error.fields).toEqual({
      slug: ["This slug is already in use."],
    });
    await db.delete(news).where(inArray(news.id, [first.id, second.id]));
  });

  it("publishes only an article with text, and shows drafts nowhere", async () => {
    const cover = await file();
    const empty = await createArticle({
      title: { az: `Test ${tag}` },
      body: { az: { type: "doc", content: [{ type: "paragraph" }] } },
      coverMediaId: cover.id,
    });
    const refused = await publishArticle(empty.id);
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as ErrorBody).error.fields).toHaveProperty(["body.az"]);

    const draft = await createArticle(article("Qaralama"));
    expect(await loadNewsArticle(db, "az", draft.slug)).toBeNull();
    const page = await loadNewsPage(db, "az", 1);
    expect(page.items.map((item) => item.slug)).not.toContain(draft.slug);

    const published = await publishArticle(draft.id);
    expect(published.status).toBe(200);
    expect(await auditOf(draft.id, "news.publish")).toHaveLength(1);
    expect(cache.revalidated).toContainEqual(["content", { expire: 0 }]);
    const shown = await loadNewsArticle(db, "en", draft.slug);
    expect(shown).toMatchObject({
      slug: draft.slug,
      title: { value: `Test ${tag}`, fallback: true },
      excerpt: { value: "Qaralama", locale: "az", fallback: true },
      body: { locale: "az", fallback: true },
    });

    // A published article cannot be emptied.
    const emptied = await newsRoute.PATCH(
      request(`/admin/news/${draft.id}`, {
        method: "PATCH",
        body: { body: { az: { type: "doc", content: [] } } },
      }),
      context(draft.id),
    );
    expect(emptied.status).toBe(422);

    const withdrawn = await newsPublicationRoute.DELETE(
      request(`/admin/news/${draft.id}/publication`, { method: "DELETE" }),
      context(draft.id),
    );
    expect(withdrawn.status).toBe(200);
    expect(await loadNewsArticle(db, "az", draft.slug)).toBeNull();
  });

  it("lists published articles newest first, with related ones and embedded images", async () => {
    const cover = await file();
    const embedded = await file({ alt: { az: "Lobbi" } });
    const noAlt = await file({ alt: null });
    const body: RichTextDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Giriş" }] },
        { type: "image", attrs: { mediaId: embedded.id } },
        { type: "image", attrs: { mediaId: noAlt.id } },
      ],
    };
    const dates = ["2026-01-10", "2026-03-10", "2026-02-10", "2026-04-10", "2026-05-10"];
    const items: AdminNews[] = [];
    for (const [i, date] of dates.entries()) {
      const created = await createArticle({
        ...article(`Xəbər ${i}`),
        slug: `t-${tag}-${i}`,
        ...(i === 0 ? { body: { az: body }, coverMediaId: cover.id } : {}),
      });
      const published = await publishArticle(created.id, { publishedAt: `${date}T10:00:00Z` });
      expect(published.status).toBe(200);
      items.push(created);
    }

    // The body's images are usages, so the library will not delete them.
    expect(await usagesOf(db, embedded.id)).toEqual([
      { entityType: "news", entityId: items[0]!.id, field: "body", label: null },
    ]);

    const page = await loadNewsPage(db, "az", 1);
    const ours = page.items.filter((item) => item.slug.startsWith(`t-${tag}-`));
    expect(ours.map((item) => item.slug)).toEqual([4, 3, 1, 2, 0].map((i) => `t-${tag}-${i}`));

    const first = await loadNewsArticle(db, "az", `t-${tag}-0`);
    expect(first?.cover?.alt).toBe("Tikinti meydançası");
    expect(Object.keys(first?.body.images ?? {})).toEqual([embedded.id]);
    expect(first?.related).toHaveLength(3);
    expect(first?.related.map((item) => item.slug)).not.toContain(`t-${tag}-0`);

    const deleted = await newsRoute.DELETE(
      request(`/admin/news/${items[0]!.id}`, { method: "DELETE" }),
      context(items[0]!.id),
    );
    expect(deleted.status).toBe(204);
    expect(await usagesOf(db, embedded.id)).toEqual([]);
    expect(await auditOf(items[0]!.id, "news.delete")).toHaveLength(1);
  });

  it("refuses writes from roles without content rights", async () => {
    const sales = await newsListRoute.POST(
      request("/admin/news", { role: "sales", body: article("Mətn") }),
    );
    expect(sales.status).toBe(403);
    const anonymous = await newsListRoute.GET(request("/admin/news", { role: null }));
    expect(anonymous.status).toBe(401);
    const cover = await newsListRoute.POST(
      request("/admin/news", { body: article("Mətn", { coverMediaId: randomUUID() }) }),
    );
    expect(cover.status).toBe(422);
  });
});

describe("scheduled publication", () => {
  // Vercel Cron sends GET; other schedulers may POST. Both behave the same.
  const cron = (token?: string, method: "GET" | "POST" = "POST") =>
    scheduledRoute[method](
      new Request(`${origin}/api/v1/internal/scheduled-publications`, {
        method,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    );

  it("schedules an article, lists it as scheduled, and cancels the schedule", async () => {
    const draft = await createArticle(article("Planlı"));
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await publishArticle(draft.id, { publishedAt: at });
    expect(scheduled.status).toBe(200);
    expect(await scheduled.json()).toMatchObject({ state: "scheduled", scheduledAt: at });
    expect(await auditOf(draft.id, "news.schedule")).toHaveLength(1);
    expect(await loadNewsArticle(db, "az", draft.slug)).toBeNull();

    const listed = (await (
      await newsListRoute.GET(request("/admin/news?status=scheduled&pageSize=100"))
    ).json()) as { items: AdminNews[] };
    expect(listed.items.map((item) => item.id)).toContain(draft.id);
    const drafts = (await (
      await newsListRoute.GET(request("/admin/news?status=draft&pageSize=100"))
    ).json()) as { items: AdminNews[] };
    expect(drafts.items.map((item) => item.id)).not.toContain(draft.id);

    // A scheduled article cannot be emptied either.
    const emptied = await newsRoute.PATCH(
      request(`/admin/news/${draft.id}`, {
        method: "PATCH",
        body: { body: { az: { type: "doc", content: [] } } },
      }),
      context(draft.id),
    );
    expect(emptied.status).toBe(422);

    const cancelled = await newsPublicationRoute.DELETE(
      request(`/admin/news/${draft.id}/publication`, { method: "DELETE" }),
      context(draft.id),
    );
    expect(await cancelled.json()).toMatchObject({ state: "draft", scheduledAt: null });
  });

  it("refuses to schedule a published article until it is withdrawn", async () => {
    const draft = await createArticle(article("Dərc"));
    expect((await publishArticle(draft.id)).status).toBe(200);
    const refused = await publishArticle(draft.id, {
      publishedAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as ErrorBody).error.fields).toHaveProperty("publishedAt");
  });

  it("publishes due entries at their scheduled time, audited as the system, and revalidates", async () => {
    const article1 = await createArticle(article("Vaxtı çatıb"));
    const later = await createArticle(article("Hələ tezdir"));
    const update = (await (await createUpdate({})).json()) as AdminConstructionUpdate;
    const soon = new Date(Date.now() + 60_000);
    await publishArticle(article1.id, { publishedAt: soon.toISOString() });
    await publishUpdate(update.id, { publishedAt: soon.toISOString() });
    await publishArticle(later.id, {
      publishedAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    cache.revalidated.length = 0;
    const early = await publishScheduled(db);
    expect(early.news).not.toContain(article1.id);

    const run = await publishScheduled(db, { now: new Date(soon.getTime() + 1000) });
    expect(run.news).toContain(article1.id);
    expect(run.news).not.toContain(later.id);
    expect(run.constructionUpdates).toContain(update.id);
    expect(cache.revalidated).toContainEqual(["content", { expire: 0 }]);

    const shown = await loadNewsArticle(db, "az", article1.slug);
    expect(shown?.publishedAt).toBe(soon.toISOString());
    const [row] = await db.select().from(news).where(eq(news.id, article1.id));
    expect(row).toMatchObject({ status: "published", scheduledAt: null });
    const [entry] = await auditOf(article1.id, "news.publish");
    expect(entry?.actorId).toBeNull();

    // A second run finds nothing left to do.
    const again = await publishScheduled(db, { now: new Date(soon.getTime() + 2000) });
    expect(again.news).not.toContain(article1.id);
    expect(again.constructionUpdates).not.toContain(update.id);
  });

  it("leaves a due article without Azerbaijani text scheduled, and reports it", async () => {
    const draft = await createArticle(article("Boşalacaq"));
    const soon = new Date(Date.now() + 60_000);
    await publishArticle(draft.id, { publishedAt: soon.toISOString() });
    // The console refuses to empty a scheduled article; only a direct write gets here.
    await db
      .update(news)
      .set({ body: { az: { type: "doc", content: [] } } })
      .where(eq(news.id, draft.id));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const run = await publishScheduled(db, { now: new Date(soon.getTime() + 1000) });
      expect(run.news).not.toContain(draft.id);
      expect(run.skippedNews).toContain(draft.id);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(draft.id));
    } finally {
      warn.mockRestore();
    }
    const [row] = await db.select().from(news).where(eq(news.id, draft.id));
    expect(row).toMatchObject({ status: "draft", scheduledAt: soon });
  });

  it("lets only a caller with the cron secret trigger a run, by GET or POST", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await cron("anything")).status).toBe(401);
    expect((await cron("anything", "GET")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "a-cron-secret-for-tests");
    expect((await cron()).status).toBe(401);
    expect((await cron("wrong")).status).toBe(401);
    expect((await cron(undefined, "GET")).status).toBe(401);
    expect((await cron("wrong", "GET")).status).toBe(401);
    const ok = await cron("a-cron-secret-for-tests");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ news: expect.any(Array) });
    const viaGet = await cron("a-cron-secret-for-tests", "GET");
    expect(viaGet.status).toBe(200);
    expect(await viaGet.json()).toMatchObject({
      news: expect.any(Array),
      constructionUpdates: expect.any(Array),
      skippedNews: expect.any(Array),
    });
    vi.unstubAllEnvs();
    vi.stubEnv("S3_PUBLIC_URL", "http://localhost:9010/test");
  });
});

describe("gallery", () => {
  it("shows published images with alt text, by category order, and only categories with any", async () => {
    const [first, second, empty] = await db
      .insert(galleryCategories)
      .values([
        { slug: `t-${tag}-b`, name: { az: `Test ${tag}` }, sortOrder: 901 },
        { slug: `t-${tag}-a`, name: { az: `Test ${tag}` }, sortOrder: 900 },
        { slug: `t-${tag}-c`, name: { az: `Test ${tag}` }, sortOrder: 902 },
      ])
      .returning();
    const shown = await file({ caption: { az: "Faylın yazısı" } });
    const another = await file();
    const noAlt = await file({ alt: null });
    const draft = await file();
    await db.insert(galleryItems).values([
      { categoryId: first!.id, mediaId: shown.id, sortOrder: 2 },
      { categoryId: first!.id, mediaId: another.id, sortOrder: 1, caption: { az: "Öz yazısı" } },
      { categoryId: second!.id, mediaId: noAlt.id },
      { categoryId: empty!.id, mediaId: draft.id, status: "draft" },
    ]);

    const gallery = await loadGallery(db, "az");
    const ours = gallery.categories.filter((category) => category.slug.startsWith(`t-${tag}`));
    expect(ours.map((category) => [category.slug, category.count])).toEqual([[`t-${tag}-b`, 2]]);
    const items = gallery.items.filter((item) => item.category === `t-${tag}-b`);
    expect(items.map((item) => [item.image.alt, item.caption?.value])).toEqual([
      ["Tikinti meydançası", "Öz yazısı"],
      ["Tikinti meydançası", "Faylın yazısı"],
    ]);
    expect(gallery.items.map((item) => item.id)).not.toContain(draft.id);
  });
});
