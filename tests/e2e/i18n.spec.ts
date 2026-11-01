import { expect, test } from "@playwright/test";

import { waitForHydration } from "./hydration";

const pages = [
  { path: "/", lang: "az", heading: "Kalbajar City" },
  { path: "/en", lang: "en", heading: "Kalbajar City" },
  { path: "/ru", lang: "ru", heading: "Kalbajar City" },
  { path: "/menziller", lang: "az", heading: "Mənzillər" },
  { path: "/en/menziller", lang: "en", heading: "Apartments" },
  { path: "/ru/menziller", lang: "ru", heading: "Квартиры" },
];

for (const { path, lang, heading } of pages) {
  test(`${path} renders in ${lang}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  });
}

test("the Azerbaijani prefix redirects to the unprefixed URL", async ({ page }) => {
  await page.goto("/az/menziller");
  await expect(page).toHaveURL(/\/menziller$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "az");
});

test("switching language keeps the apartment and the query", async ({ page, isMobile }) => {
  await page.goto("/ru/menziller/a-12?otaq=2");
  await waitForHydration(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Квартира a-12");

  // Below lg the switcher lives in the menu.
  const scope = isMobile ? page.getByRole("dialog", { name: "Меню" }) : page.getByRole("banner");
  if (isMobile) await page.getByRole("button", { name: "Открыть меню" }).click();
  const english = scope.getByRole("navigation", { name: "Язык" }).getByRole("link", {
    name: "English",
  });
  await expect(english).toHaveAttribute("href", "/en/menziller/a-12?otaq=2");
  await english.click();

  await expect(page).toHaveURL(/\/en\/menziller\/a-12\?otaq=2$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Apartment a-12");
});

test("an unknown path answers 404 in the URL's language", async ({ page }) => {
  const response = await page.goto("/en/yoxdur");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test.describe("with a Russian browser", () => {
  test.use({ locale: "ru-RU", extraHTTPHeaders: { "Accept-Language": "ru-RU,ru;q=0.9" } });

  test("Accept-Language never redirects, and a dismissible suggestion appears", async ({
    page,
  }) => {
    const response = await page.goto("/menziller");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/menziller$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "az");

    const suggestion = page.getByRole("complementary", {
      name: "Эта страница есть и на русском языке.",
    });
    await expect(suggestion).toBeVisible();
    await expect(suggestion.getByRole("link", { name: "Читать на русском" })).toHaveAttribute(
      "href",
      "/ru/menziller",
    );

    await suggestion.getByRole("button", { name: "Закрыть" }).click();
    await expect(suggestion).toBeHidden();
    await page.reload();
    await waitForHydration(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mənzillər");
    // Hydrated, so the effect has run; the dismissal is remembered.
    await expect(suggestion).toBeHidden();
  });

  test("no suggestion on a page already in the browser's language", async ({ page }) => {
    await page.goto("/ru/menziller");
    await waitForHydration(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Квартиры");
    await expect(
      page.getByRole("complementary", { name: "Эта страница есть и на русском языке." }),
    ).toHaveCount(0);
  });
});
