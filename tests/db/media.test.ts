import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import {
  auditLog,
  blocks,
  buildings,
  constructionUpdateMedia,
  constructionUpdates,
  floors,
  galleryCategories,
  galleryItems,
  homeSections,
  layoutTypes,
  media,
  mediaUsages,
  news,
  seoOverrides,
} from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";
import { S3, s3ConfigFromEnv } from "@/lib/s3";
import type { AdminMedia, AdminMediaDetail, MediaUsage, UploadTicket } from "@/shared/media";
import { paragraphs } from "@/shared/rich-text";

import { h264Mp4, hevcMp4 } from "../fixtures/mp4";
import { createUser, origin, type TestUser } from "./accounts";
import { inRollback, violates } from "./helpers";

// Outside Next, "use cache" is inert; the cache calls are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as Array<[string, unknown]> }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string, profile: unknown) => void cache.revalidated.push([tag, profile]),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const uploadsRoute = await import("@/app/api/v1/admin/media/uploads/route");
const listRoute = await import("@/app/api/v1/admin/media/route");
const itemRoute = await import("@/app/api/v1/admin/media/[id]/route");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

// The same bucket the application uses (S3_* in .env, or the CI job's env).
const bucket = new S3(s3ConfigFromEnv());

const tag = randomUUID().slice(0, 6);
const people = {} as Record<UserRole, TestUser>;
const created: string[] = [];

beforeAll(async () => {
  for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  const rows = await db.select().from(media).where(inArray(media.id, created));
  await Promise.all(
    rows
      .flatMap((row) => [row.key, ...row.variants.map((v) => v.key)])
      .map((k) => bucket.delete(k)),
  );
  await db.delete(media).where(inArray(media.id, created));
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Request {
  const headers = new Headers({ "user-agent": "vitest" });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const context = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

type ErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    usages?: MediaUsage[];
  };
};

/** Asks for a presigned PUT and sends the bytes to it, as the console does. */
async function upload(role: UserRole, bytes: Uint8Array, mimeType: string): Promise<string> {
  const ticket = await uploadsRoute.POST(
    request("/admin/media/uploads", {
      body: { filename: "file", mimeType, size: bytes.byteLength },
      cookie: people[role].cookie,
    }),
  );
  expect(ticket.status).toBe(201);
  const { key, url, method, headers } = (await ticket.json()) as UploadTicket;
  expect(key).toMatch(/^uploads\/[0-9a-f-]{36}$/);
  const sent = await fetch(url, { method, headers, body: bytes as BodyInit });
  expect(sent.status, "the presigned PUT").toBe(200);
  return key;
}

async function finish(role: UserRole, body: Record<string, unknown>) {
  const response = await listRoute.POST(
    request("/admin/media", { body, cookie: people[role].cookie }),
  );
  if (response.status === 201) {
    const item = (await response.clone().json()) as AdminMedia;
    created.push(item.id);
  }
  return response;
}

/** A 1200 × 800 photo-like JPEG stored on its side, with an EXIF rotation and a location. */
function photo() {
  return sharp({ create: { width: 800, height: 1200, channels: 3, background: "#6d7f8f" } })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect y="600" width="800" height="600" fill="#3d4a35"/></svg>`,
        ),
      },
    ])
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "kalbajar" } } })
    .toBuffer();
}

describe("uploading", () => {
  it("lets an editor upload an image through a presigned PUT, then processes it", async () => {
    const key = await upload("editor", await photo(), "image/jpeg");
    const response = await finish("editor", {
      key,
      source: "generated",
      alt: { az: "Dağ mənzərəsi" },
      focusX: 0.3,
    });
    expect(response.status).toBe(201);
    const item = (await response.json()) as AdminMedia;
    expect(item).toMatchObject({
      kind: "image",
      source: "generated",
      // A generated image is always illustrative, asked or not.
      illustrative: true,
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      focusX: 0.3,
      missingAlt: false,
      dominantColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
      lqip: expect.stringMatching(/^data:image\/webp;base64,/),
    });
    expect(item.variants.map((v) => `${v.format} ${v.width}x${v.height}`)).toEqual([
      "avif 480x320",
      "webp 480x320",
      "avif 960x640",
      "webp 960x640",
      "avif 1200x800",
      "webp 1200x800",
    ]);

    // Variants are public and immutable; the original is private; the upload is gone.
    const variant = await fetch(item.variants[0]!.url);
    expect(variant.status).toBe(200);
    expect(variant.headers.get("content-type")).toBe("image/avif");
    expect(variant.headers.get("cache-control")).toContain("immutable");
    const [row] = await db.select().from(media).where(eq(media.id, item.id));
    expect(row?.key).toBe(`originals/${item.id}.jpg`);
    expect(row?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await bucket.head(row!.key)).toMatchObject({ contentType: "image/jpeg" });
    expect((await fetch(`${bucket.config.publicUrl}/${row!.key}`)).status).toBe(403);
    expect(await bucket.head(key)).toBeNull();

    expect(cache.revalidated).toEqual([["media", { expire: 0 }]]);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, item.id), eq(auditLog.action, "media.create")));
    expect(entry).toMatchObject({ actorId: people.editor.id, before: null });
  });

  it("accepts an H.264 MP4 and stores its codec, size and duration", async () => {
    const key = await upload("admin", h264Mp4(), "video/mp4");
    const response = await finish("admin", { key, source: "owner" });
    expect(response.status).toBe(201);
    const item = (await response.json()) as AdminMedia;
    expect(item).toMatchObject({
      kind: "video",
      mimeType: "video/mp4",
      codec: "avc1.640028",
      width: 1920,
      height: 1080,
      durationMs: 12_345,
      variants: [],
      missingAlt: false,
    });
    expect(item.previewUrl).toMatch(new RegExp(`/media/${item.id}/video\\.mp4$`));
    const file = await fetch(item.previewUrl!);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("video/mp4");
  });

  it("refuses another video codec, telling the editor to export H.264", async () => {
    const key = await upload("admin", hevcMp4(), "video/mp4");
    const response = await finish("admin", { key });
    expect(response.status).toBe(422);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe("UNSUPPORTED_VIDEO_CODEC");
    expect(body.error.message).toContain("H.264 MP4");
    expect(await bucket.head(key)).toBeNull();
  });

  it("checks the bytes, never the declared type", async () => {
    const key = await upload(
      "admin",
      new TextEncoder().encode("<html>not a jpeg</html>"),
      "image/jpeg",
    );
    const response = await finish("admin", { key });
    expect(response.status).toBe(422);
    expect(((await response.json()) as ErrorBody).error.code).toBe("UNSUPPORTED_FILE");
    expect(await bucket.head(key)).toBeNull();

    // A PNG declared as a JPEG is still a PNG.
    const png = await sharp({
      create: { width: 64, height: 32, channels: 4, background: "#ffffff00" },
    })
      .png()
      .toBuffer();
    const pngKey = await upload("admin", png, "image/jpeg");
    const stored = await finish("admin", { key: pngKey, decorative: true });
    expect(stored.status).toBe(201);
    expect((await stored.json()) as AdminMedia).toMatchObject({
      mimeType: "image/png",
      width: 64,
      variants: [expect.objectContaining({ width: 64 }), expect.objectContaining({ width: 64 })],
    });
  });

  it("refuses unknown uploads, oversized files and roles without media rights", async () => {
    const unknown = await finish("admin", { key: `uploads/${randomUUID()}` });
    expect(unknown.status).toBe(422);
    expect(((await unknown.json()) as ErrorBody).error.fields).toEqual({
      key: ["The upload was not found or has expired."],
    });
    const outside = await finish("admin", { key: "originals/x.jpg" });
    expect(outside.status).toBe(422);

    const big = await uploadsRoute.POST(
      request("/admin/media/uploads", {
        body: { filename: "big.jpg", mimeType: "image/jpeg", size: 41 * 1024 * 1024 },
        cookie: people.editor.cookie,
      }),
    );
    expect(big.status).toBe(422);
    const gif = await uploadsRoute.POST(
      request("/admin/media/uploads", {
        body: { filename: "a.gif", mimeType: "image/gif", size: 10 },
        cookie: people.editor.cookie,
      }),
    );
    expect(gif.status).toBe(422);

    const sales = await uploadsRoute.POST(
      request("/admin/media/uploads", {
        body: { filename: "a.jpg", mimeType: "image/jpeg", size: 10 },
        cookie: people.sales.cookie,
      }),
    );
    expect(sales.status).toBe(403);
    const salesList = await listRoute.GET(request("/admin/media", { cookie: people.sales.cookie }));
    expect(salesList.status).toBe(403);
    const anonymous = await uploadsRoute.POST(
      request("/admin/media/uploads", {
        body: { filename: "a.jpg", mimeType: "image/jpeg", size: 10 },
      }),
    );
    expect(anonymous.status).toBe(401);
  });
});

/** A library row without stored files, for tests that do not need them. */
async function row(values: Partial<typeof media.$inferInsert> = {}) {
  const [inserted] = await db
    .insert(media)
    .values({
      key: `test/${tag}/${randomUUID()}.jpg`,
      kind: "image",
      mimeType: "image/jpeg",
      size: 10,
      width: 100,
      height: 100,
      alt: { az: "Şəkil" },
      ...values,
    })
    .returning();
  created.push(inserted!.id);
  return inserted!;
}

describe("usages and deleting", () => {
  it("lists every place a file is used and refuses to delete it until none is left", async () => {
    const file = await row();
    const id = file.id;

    const [building] = await db
      .insert(buildings)
      .values({ slug: `t-${tag}-bina`, name: { az: "Bina" } })
      .returning();
    const [block] = await db
      .insert(blocks)
      .values({
        buildingId: building!.id,
        slug: `t-${tag}-blok`,
        code: `M${tag.slice(0, 4)}`.toUpperCase(),
        name: { az: "Blok" },
      })
      .returning();
    const [floor] = await db
      .insert(floors)
      .values({ blockId: block!.id, number: 4, planMediaId: id })
      .returning();
    const [layout] = await db
      .insert(layoutTypes)
      .values({
        slug: `t-${tag}-plan`,
        code: `${tag}-p`,
        rooms: 2,
        areaTotal: "70.00",
        planMediaId: id,
      })
      .returning();
    const [article] = await db
      .insert(news)
      .values({
        slug: `t-${tag}-xeber`,
        title: { az: "Xəbər" },
        body: { az: paragraphs("Mətn") },
        coverMediaId: id,
      })
      .returning();
    const [category] = await db
      .insert(galleryCategories)
      .values({ slug: `t-${tag}-qalereya`, name: { az: "Qalereya" } })
      .returning();
    const [galleryItem] = await db
      .insert(galleryItems)
      .values({ categoryId: category!.id, mediaId: id })
      .returning();
    const [update] = await db
      .insert(constructionUpdates)
      .values({
        slug: `t-${tag}-tikinti`,
        month: "2026-09-01",
        title: { az: "Sentyabr" },
        progressPercent: 40,
      })
      .returning();
    await db.insert(constructionUpdateMedia).values({ updateId: update!.id, mediaId: id });
    const [seo] = await db
      .insert(seoOverrides)
      .values({ path: `/t-${tag}`, ogMediaId: id })
      .returning();
    const [section] = await db
      .insert(homeSections)
      .values({
        key: "card_zoom",
        content: {
          title: { az: "Səhnələr" },
          items: [{ mediaId: randomUUID() }, { mediaId: id, caption: null }],
        },
      })
      .returning();
    const embedId = randomUUID();
    await db
      .insert(mediaUsages)
      .values({ mediaId: id, entityType: "news", entityId: embedId, field: "body" });

    try {
      const detail = await itemRoute.GET(
        request(`/admin/media/${id}`, { cookie: people.editor.cookie }),
        context({ id }),
      );
      expect(detail.status).toBe(200);
      const expected: MediaUsage[] = [
        { entityType: "floor", entityId: floor!.id, field: "plan", label: `${block!.code} · 4` },
        { entityType: "layout_type", entityId: layout!.id, field: "plan", label: `${tag}-p` },
        { entityType: "news", entityId: article!.id, field: "cover", label: `t-${tag}-xeber` },
        { entityType: "gallery_item", entityId: galleryItem!.id, field: "media", label: null },
        {
          entityType: "construction_update",
          entityId: update!.id,
          field: "media",
          label: `t-${tag}-tikinti`,
        },
        { entityType: "seo_override", entityId: seo!.id, field: "ogImage", label: `/t-${tag}` },
        {
          entityType: "home_section",
          entityId: section!.id,
          field: "items.1.mediaId",
          label: "card_zoom",
        },
        { entityType: "news", entityId: embedId, field: "body", label: null },
      ];
      expect(((await detail.json()) as AdminMediaDetail).usages).toEqual(expected);

      const refused = await itemRoute.DELETE(
        request(`/admin/media/${id}`, { method: "DELETE", cookie: people.editor.cookie }),
        context({ id }),
      );
      expect(refused.status).toBe(409);
      expect(await refused.json()).toEqual({
        error: {
          code: "MEDIA_IN_USE",
          message: "The file is in use. Remove it from these places first.",
          usages: expected,
        },
      });
      expect(cache.revalidated).toEqual([]);
    } finally {
      await db.delete(mediaUsages).where(eq(mediaUsages.mediaId, id));
      await db.delete(homeSections).where(eq(homeSections.id, section!.id));
      await db.delete(seoOverrides).where(eq(seoOverrides.id, seo!.id));
      await db.delete(constructionUpdates).where(eq(constructionUpdates.id, update!.id));
      await db.delete(galleryCategories).where(eq(galleryCategories.id, category!.id));
      await db.delete(news).where(eq(news.id, article!.id));
      await db.delete(layoutTypes).where(eq(layoutTypes.id, layout!.id));
      await db.delete(floors).where(eq(floors.id, floor!.id));
      await db.delete(blocks).where(eq(blocks.id, block!.id));
      await db.delete(buildings).where(eq(buildings.id, building!.id));
    }

    const deleted = await itemRoute.DELETE(
      request(`/admin/media/${id}`, { method: "DELETE", cookie: people.editor.cookie }),
      context({ id }),
    );
    expect(deleted.status).toBe(204);
    expect(await db.select().from(media).where(eq(media.id, id))).toEqual([]);
    expect(cache.revalidated).toEqual([["media", { expire: 0 }]]);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, "media.delete")));
    expect(entry).toMatchObject({ actorId: people.editor.id, after: null });
  });

  it("deletes a processed file's stored objects with it", async () => {
    const key = await upload("editor", await photo(), "image/jpeg");
    const item = (await (await finish("editor", { key, decorative: true })).json()) as AdminMedia;
    const deleted = await itemRoute.DELETE(
      request(`/admin/media/${item.id}`, { method: "DELETE", cookie: people.admin.cookie }),
      context({ id: item.id }),
    );
    expect(deleted.status).toBe(204);
    for (const variant of item.variants) expect(await bucket.head(variant.key)).toBeNull();
    expect(await bucket.head(`originals/${item.id}.jpg`)).toBeNull();
  });
});

describe("editing", () => {
  const patch = (id: string, body: unknown, role: UserRole = "editor") =>
    itemRoute.PATCH(
      request(`/admin/media/${id}`, { method: "PATCH", body, cookie: people[role].cookie }),
      context({ id }),
    );

  it("keeps a generated image illustrative", async () => {
    const file = await row({ alt: null });
    expect(
      ((await (await patch(file.id, { decorative: false })).json()) as AdminMedia).missingAlt,
    ).toBe(true);

    const generated = await patch(file.id, { source: "generated" });
    expect(generated.status).toBe(200);
    expect(await generated.json()).toMatchObject({ source: "generated", illustrative: true });

    const refused = await patch(file.id, { illustrative: false });
    expect(refused.status).toBe(422);
    expect(((await refused.json()) as ErrorBody).error.fields).toEqual({
      illustrative: ["A generated image is always illustrative."],
    });

    const owner = await patch(file.id, { source: "stock", illustrative: false });
    expect(await owner.json()).toMatchObject({ source: "stock", illustrative: false });
  });

  it("changes alt text and the focus point, audited and revalidated", async () => {
    const file = await row();
    const response = await patch(file.id, {
      alt: { az: "Yeni", en: "New" },
      focusX: 0.1,
      focusY: 0.9,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      alt: { az: "Yeni", en: "New" },
      focusX: 0.1,
      focusY: 0.9,
    });
    expect(cache.revalidated).toEqual([["media", { expire: 0 }]]);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, file.id), eq(auditLog.action, "media.update")));
    expect(entry).toMatchObject({
      before: { alt: { az: "Şəkil" } },
      after: { alt: { az: "Yeni", en: "New" } },
    });

    expect((await patch(file.id, {})).status).toBe(422);
    expect((await patch(randomUUID(), { focusX: 0.5 })).status).toBe(404);
    expect((await patch(file.id, { focusX: 0.5 }, "sales")).status).toBe(403);
  });

  it("lists the library newest first, by kind and source", async () => {
    const video = await row({ kind: "video", mimeType: "video/mp4", source: "stock" });
    const image = await row({ source: "stock" });
    const list = async (query: string) =>
      (
        (await (
          await listRoute.GET(request(`/admin/media?${query}`, { cookie: people.editor.cookie }))
        ).json()) as { items: AdminMedia[] }
      ).items.map((item) => item.id);
    const videos = await list("kind=video&source=stock&pageSize=100");
    expect(videos).toContain(video.id);
    expect(videos).not.toContain(image.id);
    const stock = await list("source=stock&pageSize=100");
    expect(stock.indexOf(image.id)).toBeLessThan(stock.indexOf(video.id));
  });

  it("guarantees in the database that a generated image is illustrative", async () => {
    await inRollback(async (tx) => {
      await violates(tx, "media_generated_illustrative", (sp) =>
        sp.insert(media).values({
          key: `test/${tag}/generated.jpg`,
          kind: "image",
          mimeType: "image/jpeg",
          size: 1,
          source: "generated",
        }),
      );
    });
  });
});
