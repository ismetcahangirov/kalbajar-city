import { expect, type APIRequestContext } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { settings } from "@/db/schema";
import type { AdminHomeSection, HomeSectionContentByKey } from "@/shared/home-sections";
import { placeholdersSchema } from "@/shared/placeholders";
import type { AdminSetting, SettingsValue } from "@/shared/settings";

/*
 * Tests that change the shared settings run in parallel with others that read
 * or change them too, so each write is a read-modify-write of only the fields
 * the test owns, and each test puts back exactly what it changed, the
 * placeholder flags its saves removed included (#27).
 */

/** The values still flagged as stand-ins, from the database. */
export async function flaggedPaths(): Promise<string[]> {
  const { db, close } = connect(databaseUrl());
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "placeholders"));
    return placeholdersSchema.safeParse(row?.value).data?.paths ?? [];
  } finally {
    await close();
  }
}

/**
 * Flags `paths` again, keeping every other flag as it is now, then saves the
 * contacts unchanged through `request` (signed in): that revalidates the
 * cached pages, which may have been rendered while the flags were off, and
 * clears no flag, since only a changed value loses its flag.
 */
export async function restoreFlags(
  request: APIRequestContext,
  paths: readonly string[],
): Promise<void> {
  if (!paths.length) return;
  const { db, close } = connect(databaseUrl());
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(settings)
        .where(eq(settings.key, "placeholders"))
        .for("update");
      const current = placeholdersSchema.safeParse(row?.value).data?.paths ?? [];
      const value = { paths: [...new Set([...current, ...paths])] };
      await tx
        .insert(settings)
        .values({ key: "placeholders", value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    });
  } finally {
    await close();
  }
  await patchContacts(request, {});
}

/** The current contacts, through the console's endpoint (the request must be signed in). */
export async function readContacts(request: APIRequestContext) {
  const response = await request.get("/api/v1/admin/settings/contacts");
  expect(response.status()).toBe(200);
  return ((await response.json()) as AdminSetting<"contacts">).value;
}

/** Changes only `patch`'s fields of the contacts, keeping the rest as they are now. */
export async function patchContacts(
  request: APIRequestContext,
  patch: Partial<SettingsValue<"contacts">>,
) {
  const current = await readContacts(request);
  const response = await request.put("/api/v1/admin/settings/contacts", {
    data: { ...current, ...patch },
  });
  expect(response.status()).toBe(200);
}

export async function readLocation(request: APIRequestContext) {
  const response = await request.get("/api/v1/admin/home-sections/location");
  expect(response.status()).toBe(200);
  return ((await response.json()) as AdminHomeSection<"location">).content;
}

/** Changes only `patch`'s fields of the home location section. */
export async function patchLocation(
  request: APIRequestContext,
  patch: Partial<HomeSectionContentByKey["location"]>,
) {
  const current = await readLocation(request);
  const response = await request.put("/api/v1/admin/home-sections/location", {
    data: { ...current, ...patch },
  });
  expect(response.status()).toBe(200);
}
