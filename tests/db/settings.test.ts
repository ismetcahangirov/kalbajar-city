import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, homeSections, settings } from "@/db/schema";
import * as seed from "@/db/seed/data";
import type { UserRole } from "@/lib/auth/permissions";
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

const route = await import("@/app/api/v1/admin/settings/[key]/route");
const site = await import("@/lib/public/site");

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

const people = {} as Record<UserRole, TestUser>;

beforeAll(async () => {
  for (const role of ["admin", "editor", "sales"] as const) people[role] = await createUser(role);
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(settings).where(inArray(settings.key, ["contacts", "socials"]));
  await db.delete(homeSections).where(eq(homeSections.key, "location"));
});

beforeEach(() => {
  cache.revalidated.length = 0;
});

function call(method: "GET" | "PUT", key: string, user: TestUser, body?: unknown) {
  const headers = new Headers({ "user-agent": "vitest", cookie: user.cookie });
  if (body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`${origin}/api/v1/admin/settings/${key}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return route[method](request, { params: Promise.resolve({ key }) });
}

const coordinates = { lat: 40.1017, lng: 46.0381 };

describe("/api/v1/admin/settings/:key", () => {
  it("lets only roles with settings:update replace a value", async () => {
    const value = { ...seed.settings.contacts, coordinates };
    expect((await call("PUT", "contacts", people.editor, value)).status).toBe(403);
    expect((await call("PUT", "contacts", people.sales, value)).status).toBe(403);
    expect((await call("GET", "contacts", people.sales)).status).toBe(403);
    expect(cache.revalidated).toEqual([]);

    const response = await call("PUT", "contacts", people.admin, value);
    expect(response.status).toBe(200);
    const saved = (await response.json()) as AdminSetting<"contacts">;
    expect(saved.value.coordinates).toEqual(coordinates);
    expect(cache.revalidated).toEqual(["settings"]);

    const read = await call("GET", "contacts", people.admin);
    expect(((await read.json()) as AdminSetting<"contacts">).value.coordinates).toEqual(
      coordinates,
    );
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, "contacts"), eq(auditLog.action, "settings.update")));
    expect(entry).toMatchObject({ actorId: people.admin.id, entityType: "settings" });
  });

  it("validates the value against its key's schema", async () => {
    const response = await call("PUT", "contacts", people.admin, {
      ...seed.settings.contacts,
      coordinates: { lat: 200, lng: 46 },
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { fields: Record<string, string[]> } };
    expect(Object.keys(body.error.fields)).toEqual(["coordinates.lat"]);
    expect(cache.revalidated).toEqual([]);
  });

  it("answers 404 for a key that does not exist", async () => {
    expect((await call("GET", "nonsense", people.admin)).status).toBe(404);
    expect((await call("PUT", "nonsense", people.admin, {})).status).toBe(404);
  });
});

describe("public site loaders", () => {
  it("fall back to the shell's contacts until settings exist", async () => {
    await db.delete(settings).where(inArray(settings.key, ["contacts", "socials"]));
    const contacts = await site.getSiteContacts("en");
    expect(contacts.phones).toEqual(seed.settings.contacts.phones);
    expect(contacts.coordinates).toBeNull();
    expect(contacts.hours).toBeNull();
    expect(contacts.socials.instagram).toBe(seed.settings.socials.instagram);
  });

  it("read contacts, office hours and coordinates from settings, localised", async () => {
    await call("PUT", "contacts", people.admin, {
      ...seed.settings.contacts,
      email: "sales@kalbajarcity.test",
      hours: { az: "B.e.–Ş., 10:00–19:00", en: "Mon–Sat, 10:00–19:00" },
      coordinates,
    });
    const en = await site.getSiteContacts("en");
    expect(en).toMatchObject({ email: "sales@kalbajarcity.test", coordinates });
    expect(en.hours).toEqual({ value: "Mon–Sat, 10:00–19:00", locale: "en", fallback: false });
    // No Russian yet: the Azerbaijani text, marked as a fallback.
    const ru = await site.getSiteContacts("ru");
    expect(ru.hours).toMatchObject({ value: "B.e.–Ş., 10:00–19:00", locale: "az", fallback: true });
  });

  it("read the location page from the home location section", async () => {
    await db.delete(homeSections).where(eq(homeSections.key, "location"));
    expect(await site.getLocationPage("en")).toEqual({
      body: null,
      directions: null,
      map: null,
      distances: [],
    });

    await db.insert(homeSections).values({
      key: "location",
      sortOrder: 7,
      content: {
        ...seed.homeSections.location,
        directions: { az: "Gəncədən Kəlbəcərə", en: "From Ganja to Kalbajar" },
        distances: [{ place: { az: "İstisu", en: "Istisu" }, minutes: 40 }],
      },
    });
    const page = await site.getLocationPage("en");
    expect(page.directions?.value).toBe("From Ganja to Kalbajar");
    expect(page.distances).toEqual([
      { place: { value: "Istisu", locale: "en", fallback: false }, minutes: 40 },
    ]);
  });
});
