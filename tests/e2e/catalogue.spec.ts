import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { apartments, layoutTypes, media } from "@/db/schema";
import { setOwner } from "@/lib/auth/owner";

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

const cardTitles = (page: Page) =>
  page
    .getByRole("region", { name: "Nəticələr" })
    .getByRole("heading", { level: 3 })
    .allTextContents();

test("changing a filter updates the URL, and a reload shows the same results", async ({
  page,
  isMobile,
}) => {
  await page.goto("/menziller");
  await waitForHydration(page);
  const before = await cardTitles(page);

  let filters: Locator;
  if (isMobile) {
    await page.getByRole("button", { name: /^Filtrlər/ }).click();
    filters = page.getByRole("dialog", { name: "Filtrlər və sıralama" });
  } else {
    filters = page.getByRole("complementary", { name: "Filtrlər və sıralama" });
  }
  await filters.getByRole("group", { name: "Otaq sayı" }).getByLabel("3", { exact: true }).check();
  await filters.getByLabel("Sıralama").selectOption({ label: "Sahə: böyükdən kiçiyə" });

  // The count for the edited choice arrives before it is applied.
  const apply = filters.getByRole("button", { name: /mənzili göstər$/ });
  await expect(apply).toBeVisible();
  const count = (await apply.textContent())!.match(/^\d+/)?.[0];
  await apply.click();

  await expect(page).toHaveURL(/\/menziller\?otaq=3&sira=-sahe$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const status = page.getByRole("region", { name: "Nəticələr" }).getByRole("status");
  await expect(status).toContainText(`${count} mənzil`);
  const filtered = await cardTitles(page);
  expect(filtered).not.toEqual(before);
  await expect(
    page
      .getByRole("region", { name: "Nəticələr" })
      .getByText(/^3 otaq · /)
      .first(),
  ).toBeVisible();

  await page.reload();
  await expect(status).toContainText(`${count} mənzil`);
  expect(await cardTitles(page)).toEqual(filtered);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
});

test("a single room count is an indexable landing view; others are not", async ({ page }) => {
  await page.goto("/menziller?otaq=2");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 otaqlı mənzillər");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/menziller\?otaq=2$/,
  );

  await page.goto("/en/menziller?otaq=2&blok=A&nonsense=1&sahe-min=abc");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/menziller$/);
});

test("an empty result suggests the nearest match", async ({ page }) => {
  await page.goto("/menziller?otaq=1&sahe-min=150");
  await expect(page.getByRole("heading", { name: "Bu seçimə uyğun mənzil yoxdur" })).toBeVisible();
  await expect(page.getByText(/filtri olmadan \d+ mənzil var/)).toBeVisible();
  await page.getByRole("link", { name: "Onlara baxın" }).click();
  await expect(page).toHaveURL(/\/menziller\?(otaq=1|sahe-min=150)$/);
  await expect(
    page.getByRole("region", { name: "Nəticələr" }).getByRole("article"),
  ).not.toHaveCount(0);
});

test.describe("at 320 px with the keyboard alone", () => {
  test.skip(({ isMobile }) => isMobile, "one viewport is set explicitly");
  test.use({ viewport: { width: 320, height: 720 } });

  test("the catalogue's filters and pagination work", async ({ page }) => {
    await page.goto("/menziller?gorunus=siyahi");
    await waitForHydration(page);
    await expectNoHorizontalScroll(page);

    await tabTo(page, page.getByRole("button", { name: /^Filtrlər/ }));
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Filtrlər və sıralama" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Filtrləri bağla" })).toBeFocused();

    await tabTo(page, dialog.getByRole("checkbox", { name: "2", exact: true }));
    await page.keyboard.press("Space");
    await expect(dialog.getByRole("checkbox", { name: "2", exact: true })).toBeChecked();
    const apply = dialog.getByRole("button", { name: /mənzili göstər$/ });
    await expect(apply).toBeVisible();
    await tabTo(page, apply);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/menziller\?otaq=2&gorunus=siyahi$/);
    await expect(dialog).toBeHidden();
    await expectNoHorizontalScroll(page);

    const next = page.getByRole("link", { name: "Növbəti səhifə" });
    await tabTo(page, next, 200);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/menziller\?otaq=2&sehife=2&gorunus=siyahi$/);
    await expect(page.getByRole("link", { name: "Səhifə 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalScroll(page);
  });

  test("the apartment page has no horizontal scroll", async ({ page }) => {
    await page.goto("/menziller/blok-b-menzil-201");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("B blok, mənzil 201");
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole("table", { name: "Otaqların sahəsi" })).toBeVisible();
  });
});

// One apartment is marked sold and its layout given a plan, then both are
// restored, so this runs once, on desktop, in one worker (as api.spec.ts).
test.describe("an apartment changed in the console", () => {
  test.skip(({ isMobile }) => isMobile, "changes shared data; the API is viewport-independent");
  test.describe.configure({ mode: "serial" });

  const email = "e2e-catalogue@test.kalbajarcity.com";
  const password = "an e2e catalogue passphrase";
  const mediaKey = `e2e-18/plan-${randomUUID()}.png`;

  async function signIn(request: APIRequestContext, baseURL: string) {
    const octet = Math.floor(Math.random() * 250) + 1;
    const response = await request.post("/api/v1/auth/sign-in/email", {
      headers: { origin: baseURL, "x-forwarded-for": `198.51.100.${octet}` },
      data: { email, password },
    });
    expect(response.status()).toBe(200);
  }

  test("shows as sold on the next request, and its plan opens with the keyboard", async ({
    page,
    request,
    baseURL,
  }) => {
    // Block I: other tests change block A's apartments.
    const list = await request.get("/api/v1/apartments?status=available&block=I&pageSize=1");
    const [target] = ((await list.json()) as { items: Array<{ slug: string; number: string }> })
      .items;
    expect(target, "the seed has available apartments in block I").toBeTruthy();
    const { slug, number } = target!;

    const { db, close } = connect(databaseUrl());
    let mediaId: string | undefined;
    let layoutId: string | undefined;
    let adminUrl: string | undefined;
    try {
      await setOwner(db, { email, name: "E2E Catalogue Owner", password });
      const [row] = await db
        .select({ layoutTypeId: apartments.layoutTypeId, plan: layoutTypes.planMediaId })
        .from(apartments)
        .innerJoin(layoutTypes, eq(layoutTypes.id, apartments.layoutTypeId))
        .where(eq(apartments.slug, slug));
      expect(row?.plan, "the layout has no plan yet").toBeNull();
      layoutId = row!.layoutTypeId;
      const [file] = await db
        .insert(media)
        .values({
          key: mediaKey,
          kind: "image",
          mimeType: "image/png",
          size: 1000,
          width: 1600,
          height: 1200,
          alt: { az: "E2E planı" },
        })
        .returning();
      mediaId = file!.id;
      await db
        .update(layoutTypes)
        .set({ planMediaId: mediaId })
        .where(eq(layoutTypes.id, layoutId));

      // Warm the page's cache, so a stale copy would be what the next read gets.
      await page.goto(`/menziller/${slug}`);
      await expect(page.getByText("Satışda", { exact: true }).first()).toBeVisible();

      await signIn(page.request, baseURL!);
      const admin = await page.request.get(`/api/v1/admin/apartments?block=I&q=${number}`);
      const item = (
        (await admin.json()) as { items: Array<{ id: string; slug: string }> }
      ).items.find((candidate) => candidate.slug === slug);
      expect(item).toBeTruthy();
      adminUrl = `/api/v1/admin/apartments/${item!.id}`;
      const patched = await page.request.patch(adminUrl, { data: { status: "sold" } });
      expect(patched.status()).toBe(200);

      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(`/menziller/${slug}`);
      await waitForHydration(page);
      const badge = page.locator("main").getByText("Satılıb", { exact: true }).first();
      await expect(badge).toBeVisible();
      // Sold: no price and no call to action.
      await expect(page.getByText("Qiymət sorğu ilə")).toHaveCount(0);
      await expectNoHorizontalScroll(page);

      // The plan, written to the database before the revalidating write, is there too.
      const open = page.getByRole("button", { name: "Planı tam ekranda açın" });
      await tabTo(page, open);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: /^Plan: / });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Bağla" })).toBeFocused();
      const level = dialog.locator("output");
      await expect(level).toContainText("100");
      await page.keyboard.press("+");
      await expect(level).toContainText("125");
      await page.keyboard.press("+");
      await expect(level).toContainText("156");
      await page.keyboard.press("-");
      await expect(level).toContainText("125");
      await page.keyboard.press("0");
      await expect(level).toContainText("100");
      await expectNoHorizontalScroll(page);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(open).toBeFocused();
    } finally {
      if (layoutId) {
        await db.update(layoutTypes).set({ planMediaId: null }).where(eq(layoutTypes.id, layoutId));
      }
      if (mediaId) await db.delete(media).where(eq(media.id, mediaId));
      await close();
      // Restoring through the API revalidates the cache, plan removal included.
      if (adminUrl) {
        const restored = await page.request.patch(adminUrl, { data: { status: "available" } });
        expect(restored.status()).toBe(200);
      }
    }
    await page.goto(`/menziller/${slug}`);
    await expect(page.locator("main").getByText("Satışda", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Planı tam ekranda açın" })).toHaveCount(0);
  });
});
