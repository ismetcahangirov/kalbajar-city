import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { defaultImage } from "@/content/defaults";
import { connect } from "@/db/client";
import { constructionUpdates, homeSections, settings } from "@/db/schema";
import * as seed from "@/db/seed/data";

// Outside Next, "use cache" is inert; the cache calls do nothing here.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, revalidateTag: () => {} }));
vi.stubEnv("S3_PUBLIC_URL", "https://cdn.test/kalbajar");
// The loaders read through `getDb()`, which connects to DATABASE_URL.
process.env.DATABASE_URL = inject("databaseUrl");

const { getHomePage } = await import("@/lib/public/home");
const { getAboutPage } = await import("@/lib/public/site");

const { db, close } = connect(inject("databaseUrl"));

const keys = ["hero", "about", "card_zoom", "construction"] as const;
const month = "2026-10-01";

// The seed's sections, as on a new site: no poster, no image, no scenes.
beforeAll(async () => {
  await db
    .insert(settings)
    .values({ key: "complex", value: seed.settings.complex })
    .onConflictDoNothing();
  await db
    .insert(homeSections)
    .values(keys.map((key, sortOrder) => ({ key, sortOrder, content: seed.homeSections[key] })));
  await db.insert(constructionUpdates).values({
    slug: "defaults-test",
    month,
    title: { az: "Oktyabr" },
    progressPercent: 40,
    status: "published",
    publishedAt: new Date(),
  });
});

// The data-model tests count rows from an empty database, so nothing stays.
afterAll(async () => {
  await db.delete(constructionUpdates).where(eq(constructionUpdates.month, month));
  await db.delete(homeSections).where(inArray(homeSections.key, [...keys]));
  await db.delete(settings).where(eq(settings.key, "complex"));
  await close();
});

describe("empty image slots", () => {
  it("show the bundled defaults on the home page", async () => {
    const sections = await getHomePage("en");
    const byKind = Object.fromEntries(sections.map((section) => [section.kind, section]));

    expect(byKind.hero).toMatchObject({ poster: defaultImage("home.hero.poster", "en") });
    expect(byKind.about).toMatchObject({ image: defaultImage("home.about.image", "en") });
    expect(byKind.construction).toMatchObject({
      update: { image: defaultImage("home.construction.background", "en") },
    });
  });

  it("keep the card-zoom section, with the default scenes, when the console has none", async () => {
    const section = (await getHomePage("ru")).find((s) => s.kind === "card_zoom");
    expect(section).toMatchObject({
      scenes: (["1", "2", "3", "4"] as const).map((n) => ({
        key: `home.cardZoom.${n}`,
        image: defaultImage(`home.cardZoom.${n}`, "ru"),
        caption: null,
      })),
    });
  });

  it("show the about image's default on the about page", async () => {
    const page = await getAboutPage("az");
    expect(page.intro?.image).toEqual(defaultImage("home.about.image", "az"));
  });
});
