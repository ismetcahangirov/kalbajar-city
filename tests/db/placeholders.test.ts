import { and, desc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, homeSections, media, settings } from "@/db/schema";
import * as seed from "@/db/seed/data";
import type { UserRole } from "@/lib/auth/permissions";
import type { AdminHomeSection } from "@/shared/home-sections";
import type { AdminSetting } from "@/shared/settings";

import { createUser, origin, type TestUser } from "./accounts";

// Outside Next, "use cache" is inert; revalidations are recorded instead.
const cache = vi.hoisted(() => ({ revalidated: [] as string[] }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string) => void cache.revalidated.push(tag),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const settingsRoute = await import("@/app/api/v1/admin/settings/[key]/route");
const locationRoute = await import("@/app/api/v1/admin/home-sections/location/route");
const placeholdersRoute = await import("@/app/api/v1/admin/placeholders/route");
const confirmRoute = await import("@/app/api/v1/admin/placeholders/confirm/route");
const { mediaUsages } = await import("@/lib/media/usages");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const people = {} as Record<UserRole, TestUser>;

const stand = seed.placeholderValues;

/** The rows as the seed leaves them on an empty site: every stand-in written and flagged. */
const contacts = {
  ...seed.settings.contacts,
  address: stand["contacts.address"],
  coordinates: stand["contacts.coordinates"],
  hours: stand["contacts.hours"],
  email: stand["contacts.email"],
};
const location = {
  ...seed.homeSections.location,
  distances: stand["homeLocation.distances"],
  directions: stand["homeLocation.directions"],
};
const allPaths = Object.keys(stand).sort();

beforeAll(async () => {
  for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
});

beforeEach(async () => {
  cache.revalidated.length = 0;
  await reset();
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(settings).where(inArray(settings.key, ["contacts", "developer", "placeholders"]));
  await db.delete(homeSections).where(eq(homeSections.key, "location"));
});

async function reset() {
  const rows = [
    { key: "contacts", value: contacts },
    { key: "developer", value: seed.settings.developer },
    { key: "placeholders", value: { paths: allPaths } },
  ];
  for (const row of rows) {
    await db
      .insert(settings)
      .values(row)
      .onConflictDoUpdate({ target: settings.key, set: { value: row.value } });
  }
  await db
    .insert(homeSections)
    .values({ key: "location", sortOrder: 6, content: location })
    .onConflictDoUpdate({ target: homeSections.key, set: { content: location } });
}

function request(url: string, method: string, user: TestUser, body?: unknown) {
  const headers = new Headers({ "user-agent": "vitest", cookie: user.cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1/admin${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const putSetting = (key: string, user: TestUser, body: unknown) =>
  settingsRoute.PUT(request(`/settings/${key}`, "PUT", user, body), {
    params: Promise.resolve({ key }),
  });

const putLocation = (user: TestUser, body: unknown) =>
  locationRoute.PUT(request("/home-sections/location", "PUT", user, body));

const confirm = (user: TestUser, paths: string[]) =>
  confirmRoute.POST(request("/placeholders/confirm", "POST", user, { paths }));

async function flagged(): Promise<string[]> {
  const response = await placeholdersRoute.GET(request("/placeholders", "GET", people.admin));
  expect(response.status).toBe(200);
  return ((await response.json()) as { paths: string[] }).paths.sort();
}

describe("placeholder flags", () => {
  it("drop only the fields a settings save changes, in an audited write", async () => {
    const response = await putSetting("contacts", people.admin, {
      ...contacts,
      address: { az: "Kəlbəcər, Mərkəzi küçə 1", en: "1 Central Street, Kalbajar" },
    });
    expect(response.status).toBe(200);
    expect(await flagged()).toEqual(allPaths.filter((path) => path !== "contacts.address"));
    expect(cache.revalidated).toEqual(["settings"]);

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, "placeholders"), eq(auditLog.action, "settings.update")))
      .orderBy(desc(auditLog.id))
      .limit(1);
    expect(entry).toMatchObject({ actorId: people.admin.id, entityType: "settings" });
  });

  it("stay when a save leaves the stand-in as it was", async () => {
    // Key order differs from the stored jsonb; the values are the same.
    const reordered = Object.fromEntries(Object.entries(contacts).reverse());
    expect((await putSetting("contacts", people.admin, reordered)).status).toBe(200);
    expect(await flagged()).toEqual(allPaths);
  });

  it("are cleared by the location endpoint for the location section's fields", async () => {
    const response = await putLocation(people.admin, {
      ...location,
      distances: [{ place: { az: "İstisu", en: "Istisu" }, minutes: 45 }],
    });
    expect(response.status).toBe(200);
    const saved = (await response.json()) as AdminHomeSection<"location">;
    expect(saved.content.distances).toEqual([
      { place: { az: "İstisu", en: "Istisu" }, minutes: 45 },
    ]);
    expect(await flagged()).toEqual(allPaths.filter((path) => path !== "homeLocation.distances"));
    expect(cache.revalidated).toEqual(["content"]);

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "home_section.update"))
      .orderBy(desc(auditLog.id))
      .limit(1);
    expect(entry).toMatchObject({ actorId: people.admin.id, entityType: "home_section" });
  });

  it("are removed by a confirmation without changing the value", async () => {
    const response = await confirm(people.admin, ["contacts.hours", "contacts.unknown"]);
    expect(response.status).toBe(200);
    expect(await flagged()).toEqual(allPaths.filter((path) => path !== "contacts.hours"));
    const [row] = await db.select().from(settings).where(eq(settings.key, "contacts"));
    expect((row?.value as typeof contacts).hours).toEqual(stand["contacts.hours"]);
  });

  it("are not written through the generic settings endpoint", async () => {
    const response = await putSetting("placeholders", people.admin, { paths: [] });
    expect(response.status).toBe(404);
    expect(await flagged()).toEqual(allPaths);
  });
});

describe("permissions", () => {
  it("let only settings:update save settings or confirm their stand-ins", async () => {
    const value = { ...contacts, email: "sales@kalbajarcity.test" };
    for (const role of ["editor", "sales"] as const) {
      expect((await putSetting("contacts", people[role], value)).status).toBe(403);
      expect((await confirm(people[role], ["contacts.email"])).status).toBe(403);
      const list = await placeholdersRoute.GET(request("/placeholders", "GET", people[role]));
      expect(list.status).toBe(403);
    }
    expect(await flagged()).toEqual(allPaths);
    expect(cache.revalidated).toEqual([]);
  });

  it("let content:update save the location section, and not sales", async () => {
    expect((await putLocation(people.sales, location)).status).toBe(403);
    expect((await putLocation(people.editor, location)).status).toBe(200);
  });

  it("validate the location section against its schema", async () => {
    const response = await putLocation(people.admin, {
      ...location,
      distances: [{ place: { az: "" }, minutes: 0 }],
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { fields: Record<string, string[]> } };
    expect(Object.keys(body.error.fields).sort()).toEqual([
      "distances.0.minutes",
      "distances.0.place.az",
    ]);
    expect(await flagged()).toEqual(allPaths);
  });
});

describe("the developer's logo", () => {
  it("is saved by id and counted as a usage of the file", async () => {
    const [file] = await db
      .insert(media)
      .values({ key: "originals/logo-test.png", kind: "image", mimeType: "image/png", size: 10 })
      .returning();
    try {
      const response = await putSetting("developer", people.admin, {
        ...seed.settings.developer,
        logoMediaId: file!.id,
      });
      expect(response.status).toBe(200);
      const saved = (await response.json()) as AdminSetting<"developer">;
      expect(saved.value.logoMediaId).toBe(file!.id);
      expect(await mediaUsages(db, file!.id)).toEqual([
        { entityType: "settings", entityId: "developer", field: "logoMediaId", label: "developer" },
      ]);
    } finally {
      await db
        .update(settings)
        .set({ value: seed.settings.developer })
        .where(eq(settings.key, "developer"));
      await db.delete(media).where(eq(media.id, file!.id));
    }
  });
});
