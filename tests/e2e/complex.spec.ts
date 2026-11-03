import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { apartments, blocks, floors } from "@/db/schema";

import { waitForHydration } from "./hydration";

/** Presses Tab until `target` has focus: proves it is reachable by keyboard. */
async function tabTo(page: Page, target: Locator, limit = 80) {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("The element was not reached with the Tab key");
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const plan = (page: Page) => page.locator("svg.kompleks-plan");
const list = (page: Page) => page.getByRole("region", { name: "Siyahı" });

test("every public apartment is reachable through the plan and through the list", async ({
  request,
}) => {
  const { db, close } = connect(databaseUrl());
  const rows = await db
    .select({ slug: apartments.slug, block: blocks.code, floor: floors.number })
    .from(apartments)
    .innerJoin(floors, eq(floors.id, apartments.floorId))
    .innerJoin(blocks, eq(blocks.id, floors.blockId))
    .where(inArray(apartments.status, ["available", "reserved", "sold"]));
  await close();
  expect(rows.length).toBeGreaterThan(0);

  const html = async (path: string) => {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    return response.text();
  };
  // Each choice appears as a hotspot, a block or floor link and a list row.
  const linksTo = (body: string, href: string) =>
    body.split(`href="${href.replaceAll("&", "&amp;")}"`).length - 1;

  const overview = await html("/kompleks");
  const floorsByBlock = new Map<string, Set<number>>();
  for (const row of rows) {
    floorsByBlock.set(row.block, (floorsByBlock.get(row.block) ?? new Set()).add(row.floor));
  }
  for (const [block, numbers] of floorsByBlock) {
    expect(linksTo(overview, `/kompleks?blok=${block}`), block).toBeGreaterThanOrEqual(3);
    const blockPage = await html(`/kompleks?blok=${block}`);
    for (const number of numbers) {
      const href = `/kompleks?blok=${block}&mertebe=${number}`;
      expect(linksTo(blockPage, href), href).toBeGreaterThanOrEqual(3);
      const floorPage = await html(href);
      for (const row of rows.filter((r) => r.block === block && r.floor === number)) {
        // One hotspot on the plan, one row in the list.
        expect(linksTo(floorPage, `/menziller/${row.slug}`), row.slug).toBe(2);
      }
    }
  }
});

test("choosing a block, then a floor, then an apartment with the pointer", async ({
  page,
  isMobile,
}) => {
  await page.goto("/kompleks");
  await waitForHydration(page);
  await expect(page.getByRole("heading", { level: 2, name: "Bloku seçin" })).toBeVisible();

  await plan(page).locator('[data-hotspot="blok-A"]').click();
  await expect(page).toHaveURL(/\/kompleks\?blok=A$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "A blok: mərtəbəni seçin" }),
  ).toBeVisible();

  await plan(page).locator('[data-hotspot="mertebe-2"]').click();
  await expect(page).toHaveURL(/\/kompleks\?blok=A&mertebe=2$/);
  await expect(page.getByRole("heading", { level: 2, name: "A blok, mərtəbə 2" })).toBeVisible();

  // Status is a word on the plan and in the legend, not only a colour.
  const hotspots = plan(page).locator("[data-hotspot^='menzil-']");
  await expect(hotspots.first()).toBeVisible();
  const first = hotspots.first();
  const label = (await first.getAttribute("aria-label"))!;
  expect(label).toMatch(/^A blok, mənzil \d+: \d+ otaq · [\d,]+\sm², (Satışda|Rezerv|Satılıb)$/);
  await expect(page.getByText("Vəziyyət", { exact: true })).toBeVisible();

  if (!isMobile) {
    // Hover shows rooms, area and status.
    await first.hover();
    await expect(first.locator(".kompleks-detail")).toHaveCSS("opacity", "1");
    await expect(first.locator(".kompleks-summary")).toHaveCSS("opacity", "0");
  }

  await first.click();
  await expect(page).toHaveURL(/\/menziller\/blok-a-menzil-2\d+$/);

  // The back button returns to the same floor.
  await page.goBack();
  await expect(page).toHaveURL(/\/kompleks\?blok=A&mertebe=2$/);
});

test("an unknown selection falls back and is not indexed", async ({ page }) => {
  await page.goto("/kompleks?blok=ZZ&mertebe=99");
  await expect(page.getByRole("heading", { level: 2, name: "Bloku seçin" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");

  await page.goto("/kompleks?blok=A&mertebe=99");
  await expect(
    page.getByRole("heading", { level: 2, name: "A blok: mərtəbəni seçin" }),
  ).toBeVisible();

  await page.goto("/kompleks");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test.describe("at 320 px with the keyboard alone", () => {
  test.skip(({ isMobile }) => isMobile, "one viewport is set explicitly");
  test.use({ viewport: { width: 320, height: 720 } });

  test("a block, a floor and an apartment are chosen without a pointer", async ({ page }) => {
    await page.goto("/kompleks");
    await waitForHydration(page);
    await expectNoHorizontalScroll(page);

    // The block hotspot on the plan.
    const blockA = plan(page).locator('[data-hotspot="blok-A"]');
    await tabTo(page, blockA);
    await expect(blockA.locator(".kompleks-focus")).toHaveCSS("stroke-width", "6px");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/kompleks\?blok=A$/);
    // The hotspot is gone; focus lands on the new level's heading.
    const heading = page.getByRole("heading", { level: 2, name: "A blok: mərtəbəni seçin" });
    await expect(heading).toBeFocused();
    await expectNoHorizontalScroll(page);

    // A floor from the floor links.
    const floors = page.getByRole("navigation", { name: "Mərtəbələr" });
    const third = floors.getByRole("link", { name: /^Mərtəbə 3:/ });
    await tabTo(page, third);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/kompleks\?blok=A&mertebe=3$/);
    await expect(third).toHaveAttribute("aria-current", "true");
    await expectNoHorizontalScroll(page);

    // An apartment hotspot, then its details on focus.
    const apartment = plan(page).locator("[data-hotspot^='menzil-']").first();
    await tabTo(page, apartment);
    await expect(apartment.locator(".kompleks-detail")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/menziller\/blok-a-menzil-3\d+$/);
  });

  test("the list fallback reaches an apartment", async ({ page }) => {
    await page.goto("/kompleks");
    await waitForHydration(page);
    const blockRow = list(page).getByRole("link", { name: "B blok" });
    await tabTo(page, blockRow, 120);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/kompleks\?blok=B$/);

    const floorRow = list(page).getByRole("link", { name: "Mərtəbə 1" });
    await tabTo(page, floorRow, 120);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/kompleks\?blok=B&mertebe=1$/);

    const apartmentRow = list(page)
      .getByRole("link", { name: /^B blok, mənzil 1\d+$/ })
      .first();
    await tabTo(page, apartmentRow, 120);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/menziller\/blok-b-menzil-1\d+$/);
  });
});
