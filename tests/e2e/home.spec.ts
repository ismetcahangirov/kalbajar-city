import { expect, test, type Page } from "@playwright/test";

// The home page (#17) against the seeded database: every section, in the
// console's order, complete without JavaScript and with reduced motion.

const headings = {
  "/": [
    "Biz öz yuvamıza daha uca bir səviyyədə qayıdırıq.",
    "Öz mənzilinizi seçin",
    "Rahatlıq və təhlükəsizlik",
    "Yeni evinizə yol",
    "Tez-tez verilən suallar",
    "Sualınız var? Bizə yazın.",
  ],
  "/en": [
    "We are coming home, to a higher standard.",
    "Choose your apartment",
    "Comfort and safety",
    "The path to your new home",
    "Frequently asked questions",
    "Have a question? Write to us.",
  ],
  "/ru": [
    "Мы возвращаемся домой — на новом уровне.",
    "Выберите свою квартиру",
    "Комфорт и безопасность",
    "Путь к новому дому",
    "Частые вопросы",
    "Есть вопрос? Напишите нам.",
  ],
};

/**
 * Section headings by accessible name: LineReveal splits a heading into line
 * spans and keeps its text in `aria-label`, so `textContent` loses spaces.
 *
 * The construction teaser (`#tikinti`) is left out: the seed has no published
 * update, and tests/e2e/content.spec.ts publishes one for a moment while
 * these tests may be running.
 */
function sectionHeadings(page: Page) {
  return page
    .locator("main h2:not(#tikinti)")
    .evaluateAll((list) =>
      list.map((h) => (h.getAttribute("aria-label") ?? h.textContent ?? "").trim()),
    );
}

for (const [path, expected] of Object.entries(headings)) {
  test(`${path} shows every section in order`, async ({ page }) => {
    await page.goto(path);
    expect(await sectionHeadings(page)).toEqual(expected);
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page is complete and readable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Sizin də dağ mənzərəli mənziliniz olsun!",
    );
    expect(await sectionHeadings(page)).toHaveLength(6);

    const stats = page.getByLabel("Rəqəmlərlə Kalbajar City");
    await expect(stats).toContainText("22 634");
    await expect(stats).toContainText("143");
    await expect(stats).toContainText("160");

    // The FAQ answers are in the HTML, inside <details>.
    await page.getByText("Avtomobil üçün yer varmı?").click();
    await expect(page.getByText("Bəli, kompleksdə 160 yerlik yeraltı qaraj var.")).toBeVisible();
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("stats show their final values and nothing is hidden", async ({ page }) => {
    await page.goto("/ru");
    const stats = page.getByLabel("Kalbajar City в цифрах");
    await stats.scrollIntoViewIfNeeded();
    await expect(stats).toContainText("22 634");
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main *")]
        .filter((element) => Number(getComputedStyle(element).opacity) < 1)
        .filter((element) => !element.closest("[data-hero-video]"))
        // `Checkbox` draws its own box over the native input, transparent by design.
        .filter((element) => !element.matches('input[type="checkbox"]'))
        .map((element) => element.outerHTML.slice(0, 80)),
    );
    expect(hidden).toEqual([]);
  });
});

test("the stat numeral and its unit do not overlap", async ({ page }) => {
  await page.goto("/");
  const total = page.getByLabel("Rəqəmlərlə Kalbajar City").locator("dd").first();
  await total.scrollIntoViewIfNeeded();
  await expect(total).toContainText("22 634");
  const [numeral, unit] = await Promise.all([
    total.locator("[data-stat-value]").boundingBox(),
    total.getByText("m²").boundingBox(),
  ]);
  expect(numeral && unit && unit.x >= numeral.x + numeral.width).toBe(true);
});

test("layout cards lead to the filtered catalogue", async ({ page }) => {
  await page.goto("/en");
  const card = page.getByRole("link", { name: "2-room apartments" });
  await expect(card).toHaveAttribute("href", "/en/menziller?otaq=2");
  await expect(page.getByText("74.4–102.17 m² · 2 layouts")).toBeVisible();
});

test("hero chips summarise the inventory", async ({ page }) => {
  await page.goto("/ru");
  const chips = page.getByRole("list", { name: "Коротко" });
  await expect(chips.getByRole("listitem")).toHaveText([
    "143 квартиры",
    "1–4 комнаты",
    "от 62,09 м²",
  ]);
});

test("the FAQ is published as FAQPage structured data", async ({ page }) => {
  await page.goto("/en");
  // One JSON-LD document per page; the FAQ is one node of its graph.
  const scripts = page.locator('script[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  const graph = JSON.parse((await scripts.textContent()) ?? "{}") as {
    "@graph": Array<{
      "@type": string;
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    }>;
  };
  const data = graph["@graph"].find((node) => node["@type"] === "FAQPage")!;
  expect(data).toBeDefined();
  expect(data.mainEntity).toHaveLength(6);
  expect(data.mainEntity[2]).toEqual({
    "@type": "Question",
    name: "Is there parking?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Yes, the complex has an underground car park with 160 spaces.",
    },
  });
});

for (const path of ["/", "/ru"]) {
  for (const width of [320, 768, 1024, 1920]) {
    test(`${path} has no horizontal scroll at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
}
