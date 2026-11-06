import { randomUUID } from "node:crypto";

import { desc, eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest";

import { connect } from "@/db/client";
import { auditLog, faq, homeSections, layoutTypes, media, settings } from "@/db/schema";
import * as seed from "@/db/seed/data";
import type { UserRole } from "@/lib/auth/permissions";
import { homeSectionKeys, type AdminHomeSection } from "@/shared/home-sections";

import { createUser, origin, type TestUser } from "./accounts";

// Outside Next, "use cache" is inert; the cache calls are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as string[] }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string) => void cache.revalidated.push(tag),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

vi.stubEnv("S3_PUBLIC_URL", "http://localhost:9010/test");

const listRoute = await import("@/app/api/v1/admin/home-sections/route");
const orderRoute = await import("@/app/api/v1/admin/home-sections/order/route");
const sectionRoute = await import("@/app/api/v1/admin/home-sections/[key]/route");
const { getHomePage } = await import("@/lib/public/home");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const people = {} as Record<UserRole, TestUser>;

beforeAll(async () => {
  for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

// The data-model tests count rows from an empty database, so nothing stays.
const layoutIds: string[] = [];
const mediaIds: string[] = [];
afterEach(async () => {
  await db.delete(homeSections);
  await db.delete(settings).where(eq(settings.key, "complex"));
  if (layoutIds.length) await db.delete(layoutTypes).where(inArray(layoutTypes.id, layoutIds));
  if (mediaIds.length) await db.delete(media).where(inArray(media.id, mediaIds));
  layoutIds.length = 0;
  mediaIds.length = 0;
});

function request(path: string, method: string, user: TestUser, body?: unknown) {
  const headers = new Headers({ "user-agent": "vitest", cookie: user.cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const context = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

const putSection = (key: string, user: TestUser, body: unknown) =>
  sectionRoute.PUT(request(`/home-sections/${key}`, "PUT", user, body), context({ key }));

const putOrder = (user: TestUser, sections: unknown) =>
  orderRoute.PUT(request("/home-sections/order", "PUT", user, { sections }), context());

const shuffled = () => {
  const [hero, ...rest] = homeSectionKeys.map((key) => ({ key, visible: key !== "faq" }));
  return [hero, ...rest.reverse()];
};

async function addMedia(kind: "image" | "video") {
  const [row] = await db
    .insert(media)
    .values({
      key: `t/${randomUUID()}`,
      kind,
      mimeType: kind === "image" ? "image/jpeg" : "video/mp4",
      originalName: "t",
      size: 1,
      width: 800,
      height: 600,
      alt: { az: "Şəkil" },
      uploadedBy: people.admin.id,
    })
    .returning();
  mediaIds.push(row!.id);
  return row!.id;
}

async function lastAudit(action: string) {
  const [entry] = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, action))
    .orderBy(desc(auditLog.id))
    .limit(1);
  return entry;
}

describe("the home page with nothing saved", () => {
  it("renders every section that has something to show, from the defaults", async () => {
    await db.delete(faq);
    const sections = await getHomePage("en");
    expect(sections[0]).toMatchObject({
      kind: "hero",
      title: { value: seed.homeSections.hero.title.en },
    });
    const kinds = sections.map((section) => section.kind);
    expect(kinds).toEqual(["hero", "stats", "about", "amenities", "card_zoom", "process", "cta"]);
    const stats = sections.find((section) => section.kind === "stats");
    expect(stats).toMatchObject({ items: [{ value: 22634 }, { value: 143 }, {}, {}] });
  });
});

describe("the console's list", () => {
  it("answers every section, with defaults for those without a row", async () => {
    const response = await listRoute.GET(
      request("/home-sections", "GET", people.editor),
      context(),
    );
    expect(response.status).toBe(200);
    const list = (await response.json()) as AdminHomeSection[];
    expect(list.map((section) => section.key)).toEqual([...homeSectionKeys]);
    expect(list[0]).toMatchObject({ visible: true, updatedAt: null, sortOrder: 0 });
  });

  it("is refused without the content permission", async () => {
    const response = await listRoute.GET(request("/home-sections", "GET", people.sales), context());
    expect(response.status).toBe(403);
  });
});

describe("order and visibility", () => {
  it("change what the home page shows, audited and revalidated", async () => {
    const response = await putOrder(people.editor, shuffled());
    expect(response.status).toBe(200);
    expect(cache.revalidated).toContain("content");

    const entry = await lastAudit("home_section.order");
    expect(entry).toMatchObject({ actorId: people.editor.id, entityType: "home_section" });
    expect(entry?.after).toMatchObject({ hidden: ["faq"] });

    const kinds = (await getHomePage("az")).map((section) => section.kind);
    expect(kinds[0]).toBe("hero");
    expect(kinds[1]).toBe("cta");
    expect(kinds.at(-1)).toBe("stats");
    expect(kinds).not.toContain("faq");
  });

  it("refuses to move or hide the hero", async () => {
    const list = homeSectionKeys.map((key) => ({ key, visible: true }));
    expect((await putOrder(people.editor, [...list].reverse())).status).toBe(422);
    expect(
      (await putOrder(people.editor, [{ key: "hero", visible: false }, ...list.slice(1)])).status,
    ).toBe(422);
    expect(await db.select().from(homeSections)).toEqual([]);
  });

  it("refuses a user without the permission", async () => {
    expect((await putOrder(people.sales, shuffled())).status).toBe(403);
  });
});

describe("a section's content", () => {
  it("shows on the home page, audited and revalidated", async () => {
    const [panel, video] = [await addMedia("image"), await addMedia("video")];
    const response = await putSection("hero", people.editor, {
      title: { az: "Yeni başlıq", en: "New headline" },
      panelMediaId: panel,
      videoMediaId: video,
    });
    expect(response.status).toBe(200);
    expect(cache.revalidated).toContain("content");
    expect((await lastAudit("home_section.update"))?.actorId).toBe(people.editor.id);

    const [hero] = await getHomePage("en");
    expect(hero).toMatchObject({ kind: "hero", title: { value: "New headline" } });
    if (hero?.kind !== "hero") throw new Error("hero first");
    expect(hero.panel.alt).toBe("Şəkil");
    expect(hero.video?.type).toBe("video/mp4");
  });

  it("features the layouts the console chooses, in its order", async () => {
    const added = await db
      .insert(layoutTypes)
      .values(
        [1, 2, 3].map((rooms) => ({
          slug: `t-${randomUUID().slice(0, 8)}`,
          code: `t-${randomUUID().slice(0, 8)}`,
          rooms,
          areaTotal: "60.00",
        })),
      )
      .returning();
    layoutIds.push(...added.map((row) => row.id));

    expect(
      (
        await putSection("layouts", people.editor, {
          ...seed.homeSections.layouts,
          featuredRooms: [3, 1],
        })
      ).status,
    ).toBe(200);
    const section = (await getHomePage("az")).find((candidate) => candidate.kind === "layouts");
    if (section?.kind !== "layouts") throw new Error("layouts shown");
    expect(section.groups.map((group) => group.rooms)).toEqual([3, 1]);
  });

  it("refuses invalid content, an unknown section, and media of the wrong kind", async () => {
    expect((await putSection("hero", people.editor, { title: { en: "No az" } })).status).toBe(422);
    expect((await putSection("nope", people.editor, {})).status).toBe(404);

    const image = await addMedia("image");
    const wrongKind = await putSection("hero", people.editor, {
      ...seed.homeSections.hero,
      videoMediaId: image,
    });
    expect(wrongKind.status).toBe(422);
    const missing = await putSection("about", people.editor, {
      ...seed.homeSections.about,
      backgroundMediaId: randomUUID(),
    });
    expect(missing.status).toBe(422);
  });

  it("is refused without the permission", async () => {
    expect((await putSection("cta", people.sales, seed.homeSections.cta)).status).toBe(403);
  });
});
