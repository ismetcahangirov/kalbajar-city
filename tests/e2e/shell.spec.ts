import { expect, test, type Page } from "@playwright/test";

import az from "@/i18n/messages/az.json";

import { waitForHydration } from "./hydration";

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the header row exists from lg");

  test("the header links the pages and marks the current one", async ({ page }) => {
    await page.goto("/ru/menziller");
    const header = page.getByRole("banner");
    const nav = header.getByRole("navigation", { name: "Главное меню" });
    await expect(nav.getByRole("link", { name: "Квартиры" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Комплекс" })).not.toHaveAttribute("aria-current");
    await expect(header.getByRole("link", { name: "Позвонить" })).toHaveAttribute(
      "href",
      "tel:+994124343232",
    );
    await expect(page.getByRole("complementary", { name: "Быстрая связь" })).toBeHidden();

    await nav.getByRole("link", { name: "О нас" }).click();
    await expect(page).toHaveURL(/\/ru\/haqqimizda$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("О нас");
  });

  test("the header is transparent over a hero and solid after it", async ({ page }) => {
    await page.goto("/primitivler");
    await waitForHydration(page);
    const header = page.locator("[data-site-header]");
    const layer = header.locator("[data-header-layer]");

    await expect(layer).toHaveCSS("opacity", "0");
    // Cream text over the hero, from the night set of tokens.
    await expect(header).toHaveCSS("color", "rgb(247, 242, 232)");

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
    await expect(header).toHaveAttribute("data-solid", "");
    await expect(layer).toHaveCSS("opacity", "1");
    await expect(header).toHaveCSS("color", "rgb(18, 16, 14)");
  });

  test("a page without a hero gets the solid header", async ({ page }) => {
    await page.goto("/elaqe");
    await expect(page.locator("[data-header-layer]")).toHaveCSS("opacity", "1");
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "the menu and the action bar exist below lg");

  test("the menu traps focus and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    const button = page.getByRole("button", { name: "Menyunu aç" });
    await button.click();

    const menu = page.getByRole("dialog", { name: "Menyu" });
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("button", { name: "Menyunu bağla" })).toBeFocused();

    // More presses than the menu has stops: focus never reaches the page.
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => document.activeElement?.closest("[data-mobile-menu]") !== null,
      );
      expect(inside).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("the menu closes when a link changes the route", async ({ page }) => {
    await page.goto("/en");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await menu.getByRole("link", { name: "Gallery" }).click();

    await expect(page).toHaveURL(/\/en\/qalereya$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gallery");
    await expect(menu).toBeHidden();
  });

  test("the action bar offers a call and WhatsApp", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("complementary", { name: "Tez əlaqə" });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Zəng edin" })).toHaveAttribute(
      "href",
      "tel:+994124343232",
    );
    // The chat opens with a message typed in, in the page's language.
    await expect(bar.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      `https://wa.me/994505535555?text=${encodeURIComponent(az.Shell.whatsappMessage)}`,
    );
    const box = await bar.getByRole("link", { name: "Zəng edin" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(56);
  });
});

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  await page.goto("/menziller");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Əsas məzmuna keç" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

for (const path of ["/", "/en/menziller", "/ru/menziller"]) {
  test(`${path} has no horizontal scroll at 320 px and the wordmark fits`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(await overflow(page)).toBe(0);

    const wordmark = page.locator("footer [aria-hidden] p");
    const fits = await wordmark.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
  });
}

test("the footer lists every page, the contacts and the privacy notice", async ({ page }) => {
  await page.goto("/ru");
  const footer = page.getByRole("contentinfo");
  const sitemap = footer.getByRole("navigation", { name: "Карта сайта" });
  await expect(sitemap.getByRole("link")).toHaveCount(8);
  await expect(footer.getByRole("link", { name: "+994 12 434 32 32" })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Instagram" })).toHaveAttribute(
    "href",
    "https://www.instagram.com/kalbajar.city/",
  );
  await expect(footer.getByRole("link", { name: "Политика конфиденциальности" })).toHaveAttribute(
    "href",
    "/ru/mexfilik-siyaseti",
  );
});
