import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

import type { AdminHomeSection, HomeSectionKey } from "@/shared/home-sections";
import type { AdminConstructionUpdate } from "@/shared/content";
import type { AdminMedia, UploadTicket } from "@/shared/media";

import { ensureAccount, signIn, uploadImage, waitForShell } from "./console";
import { waitForHydration } from "./hydration";
import { horizontalOverflow } from "./public-routes";

/*
 * The home sections screen and what its choices do to the public page (#17).
 * Order and visibility change every visitor's home page, so these run in the
 * `exclusive` project, after every other spec, and each test puts back what
 * it changed.
 */

const screen = "/admin/xeberler/ana-sehife";
const api = "/api/v1/admin/home-sections";

const defaultOrder: HomeSectionKey[] = [
  "hero",
  "stats",
  "about",
  "layouts",
  "amenities",
  "card_zoom",
  "location",
  "construction",
  "process",
  "faq",
  "cta",
];

/** The section's `h2` id, or how the scene is found: the stats have an `aria-label`, no heading. */
const anchors: Partial<Record<HomeSectionKey, string>> = {
  about: "#haqqinda",
  layouts: "#planlar",
  amenities: "#ustunlukler",
  card_zoom: "#menzereler",
  location: "#yerlesme",
  process: "#addimlar",
  faq: "#suallar",
  cta: "#muraciet",
};

type Arrangement = Array<{ key: HomeSectionKey; visible: boolean }>;

function arrangement(order: HomeSectionKey[], hidden: HomeSectionKey[] = []): Arrangement {
  const rest = defaultOrder.filter((key) => !order.includes(key));
  return [...order, ...rest].map((key) => ({ key, visible: !hidden.includes(key) }));
}

async function signInEditor(page: Page, baseURL: string) {
  const email = "e2e-home-sections@test.kalbajarcity.com";
  await ensureAccount("editor", email, "E2E Home Sections Editor");
  await signIn(page, email, baseURL);
}

async function putOrder(request: APIRequestContext, sections: Arrangement) {
  const response = await request.put(`${api}/order`, { data: { sections } });
  expect(response.status()).toBe(200);
}

/** The headings under <main> in document order, the way the page reads them. */
function shownAnchors(page: Page) {
  return page.evaluate(
    (anchors) =>
      Object.entries(anchors)
        .flatMap(([key, selector]) => {
          const element = document.querySelector(selector);
          return element ? [{ key, element }] : [];
        })
        .sort((a, b) =>
          a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        )
        .map(({ key }) => key),
    anchors,
  );
}

/** What the arrangement should show of the sections with a heading, in order. */
function expectedAnchors(sections: Arrangement) {
  return sections
    .filter(({ key, visible }) => visible && anchors[key])
    .map(({ key }) => key as string);
}

const statsScene = (page: Page) => page.getByLabel("Rəqəmlərlə Kalbajar City");

const arrangements: Array<{ name: string; sections: Arrangement }> = [
  {
    name: "reversed",
    sections: arrangement(["hero", ...[...defaultOrder].slice(1).reverse()]),
  },
  {
    name: "the stats right after a section shorter than the screen",
    sections: arrangement(["hero", "faq", "stats", "about", "cta"], ["layouts", "card_zoom"]),
  },
  {
    name: "the stats last",
    sections: arrangement(["hero", "cta", "about", "stats"], ["faq", "process", "location"]),
  },
  {
    name: "no stats, so the hero meets a plain section",
    sections: arrangement(["hero", "process", "about", "cta"], ["stats", "amenities", "layouts"]),
  },
  {
    name: "only the hero",
    sections: arrangement(
      ["hero"],
      defaultOrder.filter((key) => key !== "hero"),
    ),
  },
];

test.describe.serial("the home page's arrangement", () => {
  let original: Arrangement;

  test.beforeAll(async ({ browser, baseURL }) => {
    const page = await browser.newPage();
    await signInEditor(page, baseURL!);
    const response = await page.request.get(api);
    original = ((await response.json()) as AdminHomeSection[]).map(({ key, visible }) => ({
      key,
      visible,
    }));
    await page.close();
  });

  test.afterAll(async ({ browser, baseURL }) => {
    const page = await browser.newPage();
    await signInEditor(page, baseURL!);
    await putOrder(page.request, original);
    await page.close();
  });

  for (const { name, sections } of arrangements) {
    const hasStats = sections.find(({ key }) => key === "stats")?.visible;

    test(`${name}: scenes run with motion`, async ({ page, baseURL }) => {
      await signInEditor(page, baseURL!);
      await putOrder(page.request, sections);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto("/");
      await waitForHydration(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await shownAnchors(page)).toEqual(expectedAnchors(sections));

      // Every scene is walked through at its scroll position.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 450) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
        await page.waitForTimeout(20);
        expect(await horizontalOverflow(page)).toBe(0);
      }
      await expect(page.locator("footer").last()).toBeInViewport();
      expect(errors).toEqual([]);

      if (hasStats) {
        // Scene engine: the stats scene overlaps the one before it and clips
        // the overlap, whatever that scene is, and its iris opens on its own
        // scroll range.
        const stats = statsScene(page);
        const scene = await stats.evaluate((element) => {
          const style = getComputedStyle(element);
          return { margin: style.marginTop, clip: style.clipPath };
        });
        expect(parseFloat(scene.margin)).toBeLessThan(0);
        expect(scene.clip).toContain("inset");

        const top = await stats.evaluate(
          (element) => element.getBoundingClientRect().top + window.scrollY,
        );
        const viewport = page.viewportSize()!.height;
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
        await page.waitForTimeout(100);
        // The clipped overlap takes no clicks: what is under it stays usable.
        const overStats = await page.evaluate(
          (y) =>
            !!document
              .elementFromPoint(window.innerWidth / 2, y)
              ?.closest('[aria-label="Rəqəmlərlə Kalbajar City"]'),
          viewport / 2,
        );
        expect(overStats).toBe(false);

        await page.evaluate(
          (y) => window.scrollTo({ top: y, behavior: "instant" }),
          top + viewport,
        );
        await expect(stats.locator("[data-stat-value]").first()).toBeInViewport();
      }
    });

    test.describe(`${name}: with reduced motion`, () => {
      test.use({ reducedMotion: "reduce" });

      test("the page is a plain stack, in its final state", async ({ page, baseURL }) => {
        await signInEditor(page, baseURL!);
        await putOrder(page.request, sections);
        await page.goto("/");
        await waitForHydration(page);
        expect(await shownAnchors(page)).toEqual(expectedAnchors(sections));

        const state = await page.evaluate(() => ({
          pinned: [...document.querySelectorAll("main [data-layer]")].filter(
            (layer) => getComputedStyle(layer).position === "sticky",
          ).length,
          overlapped: [...document.querySelectorAll("main [data-scroll-scene]")].filter(
            (scene) => parseFloat(getComputedStyle(scene).marginTop) < 0,
          ).length,
          hidden: [...document.querySelectorAll<HTMLElement>("[data-reveal], [data-stat-value]")]
            .filter((element) => Number(getComputedStyle(element).opacity) < 1)
            .map((element) => element.outerHTML.slice(0, 80)),
        }));
        expect(state).toEqual({ pinned: 0, overlapped: 0, hidden: [] });

        if (hasStats) await expect(statsScene(page)).toContainText("22 634");
        for (const { key, visible } of sections) {
          const selector = anchors[key];
          if (selector && visible) await expect(page.locator(selector)).toBeAttached();
        }
      });
    });

    test.describe(`${name}: without JavaScript`, () => {
      test("the server HTML has the sections in order", async ({ browser, baseURL, page }) => {
        await signInEditor(page, baseURL!);
        await putOrder(page.request, sections);
        const off = await browser.newContext({ javaScriptEnabled: false, baseURL });
        const plain = await off.newPage();
        await plain.goto("/");
        await expect(plain.getByRole("heading", { level: 1 })).toBeVisible();
        const html = await plain.content();
        const positions = expectedAnchors(sections).map((key) =>
          html.indexOf(`id="${anchors[key as HomeSectionKey]!.slice(1)}"`),
        );
        expect(positions.every((position) => position > 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        await off.close();
      });
    });
  }

  test("the hero cannot be moved or hidden through the API", async ({ page, baseURL }) => {
    await signInEditor(page, baseURL!);
    const moved = await page.request.put(`${api}/order`, {
      data: { sections: [...arrangement(defaultOrder)].reverse() },
    });
    expect(moved.status()).toBe(422);
  });

  test("a hidden FAQ leaves the structured data too", async ({ page, baseURL }) => {
    await signInEditor(page, baseURL!);
    await putOrder(page.request, arrangement(defaultOrder, ["faq"]));
    await page.goto("/en");
    await expect(page.locator("#suallar")).toHaveCount(0);
    const graph = await page.locator('script[type="application/ld+json"]').textContent();
    expect(graph).not.toContain("FAQPage");
  });

  test("an editor arranges the page from the console, on a phone too", async ({
    page,
    baseURL,
  }) => {
    await signInEditor(page, baseURL!);
    await putOrder(page.request, arrangement(defaultOrder));
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(screen);
    await waitForShell(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ana səhifə");
    await expect(
      page
        .getByRole("navigation", { name: "Məzmunun bölmələri" })
        .getByRole("link", { name: "Ana səhifə" }),
    ).toHaveAttribute("aria-current", "page");
    expect(await horizontalOverflow(page)).toBe(0);

    // The hero has no controls: it stays first and shown.
    await expect(page.getByRole("switch", { name: "Giriş ekranı: saytda göstər" })).toHaveCount(0);

    const saved = () =>
      page.waitForResponse(
        (response) => response.url().endsWith(`${api}/order`) && response.status() === 200,
      );

    // Hide the FAQ with its switch.
    const faq = page.getByRole("switch", { name: "Suallar: saytda göstər" });
    const hide = saved();
    await faq.click();
    await hide;
    await expect(faq).not.toBeChecked();

    // Move the location down with its button.
    const move = saved();
    await page.getByRole("button", { name: "Aşağı apar: Yerləşmə" }).click();
    await move;

    await page.goto("/");
    await expect(page.locator("#suallar")).toHaveCount(0);
    const shown = await shownAnchors(page);
    expect(shown).not.toContain("faq");
    expect(shown.indexOf("location")).toBeGreaterThan(-1);
  });

  test("an editor changes the hero's copy and the featured layouts", async ({ page, baseURL }) => {
    await signInEditor(page, baseURL!);
    const before = (await (await page.request.get(api)).json()) as AdminHomeSection[];
    const content = (key: HomeSectionKey) => before.find((s) => s.key === key)!.content;

    try {
      await page.goto(screen);
      await waitForShell(page);

      const hero = page.locator('details[data-section="hero"]');
      await hero.locator("summary").click();
      await hero.getByLabel("Başlıq (Azərbaycanca)", { exact: true }).fill("Yeni başlıq, e2e");
      const savedHero = page.waitForResponse(
        (response) => response.url().endsWith(`${api}/hero`) && response.status() === 200,
      );
      await hero.getByRole("button", { name: "Yadda saxla" }).click();
      await savedHero;

      const layouts = page.locator('details[data-section="layouts"]');
      await layouts.locator("summary").click();
      await layouts.getByRole("switch", { name: "1 otaqlı: saytda göstər" }).click();
      await layouts.getByRole("button", { name: "Yuxarı apar: 4 otaqlı" }).click();
      const savedLayouts = page.waitForResponse(
        (response) => response.url().endsWith(`${api}/layouts`) && response.status() === 200,
      );
      await layouts.getByRole("button", { name: "Yadda saxla" }).click();
      await savedLayouts;

      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeni başlıq, e2e");
      const rows = page.locator("#planlar ~ ul [data-hover-link]");
      await expect(rows).toHaveText([/2/, /4/, /3/]);
      await expect(rows.first()).toHaveAttribute("href", "/menziller?otaq=2");
    } finally {
      await page.request.put(`${api}/hero`, { data: content("hero") });
      await page.request.put(`${api}/layouts`, { data: content("layouts") });
    }
  });

  test("an image chosen for the hero panel is the page's LCP image, loaded eagerly", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signInEditor(page, baseURL!);
    const before = (await (await page.request.get(api)).json()) as AdminHomeSection[];
    const hero = before.find((section) => section.key === "hero")!.content;

    // Grain, or the browser takes it for a placeholder and no LCP candidate.
    const jpeg = await sharp({
      create: {
        width: 2000,
        height: 1400,
        channels: 3,
        background: { r: 120, g: 110, b: 90 },
        noise: { type: "gaussian", mean: 128, sigma: 40 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    const ticket = (await (
      await page.request.post("/api/v1/admin/media/uploads", {
        data: { filename: "panel.jpg", mimeType: "image/jpeg", size: jpeg.byteLength },
      })
    ).json()) as UploadTicket;
    const put = await page.request.fetch(ticket.url, {
      method: ticket.method,
      headers: ticket.headers,
      data: jpeg,
    });
    expect(put.status()).toBe(200);
    const created = await page.request.post("/api/v1/admin/media", {
      data: {
        key: ticket.key,
        source: "owner",
        originalName: "e2e-panel.jpg",
        alt: { az: "Bina", en: "Building", ru: "Здание" },
      },
    });
    expect(created.status()).toBe(201);
    const item = (await created.json()) as AdminMedia;

    try {
      await page.goto(screen);
      await waitForShell(page);
      const section = page.locator('details[data-section="hero"]');
      await section.locator("summary").click();
      const panel = section.getByRole("group", { name: "Sağdakı böyük şəkil" });
      await expect(panel).toContainText("standart şəkil");
      await panel.getByRole("button", { name: "Şəkil seç" }).click();
      await page.getByRole("dialog").locator("li button", { hasText: "e2e-panel.jpg" }).click();
      const saved = page.waitForResponse(
        (response) => response.url().endsWith(`${api}/hero`) && response.status() === 200,
      );
      await section.getByRole("button", { name: "Yadda saxla" }).click();
      await saved;

      await page.goto("/");
      const image = page.locator(`[data-hero-panel] img[src*="/media/${item.id}/"]`);
      await expect(image).toHaveAttribute("fetchpriority", "high");
      await expect(image).toHaveAttribute("alt", "Bina");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              new Promise<string>((resolve) => {
                new PerformanceObserver((list) => {
                  const last = list.getEntries().at(-1) as PerformanceEntry & { url?: string };
                  resolve(last.url ?? "");
                }).observe({ type: "largest-contentful-paint", buffered: true });
                setTimeout(() => resolve(""), 1000);
              }),
          ),
        )
        .toContain(`/media/${item.id}/`);
    } finally {
      await page.request.put(`${api}/hero`, { data: hero });
      expect((await page.request.delete(`/api/v1/admin/media/${item.id}`)).status()).toBe(204);
    }
  });

  test("an image chosen for the construction teaser shows while the latest update has none", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await signInEditor(page, baseURL!);
    const before = (await (await page.request.get(api)).json()) as AdminHomeSection[];
    const construction = before.find((section) => section.key === "construction")!.content;
    await putOrder(page.request, arrangement(defaultOrder));

    // A month after any real one, so it is the latest update, and it has no photo.
    const created = await page.request.post("/api/v1/admin/construction-updates", {
      data: { month: "2099-12", title: { az: "Sınaq yeniliyi" }, progressPercent: 50 },
    });
    expect(created.status()).toBe(201);
    const update = (await created.json()) as AdminConstructionUpdate;
    const item = await uploadImage(page.request, "e2e-construction.jpg", "Tikinti sahəsi");

    try {
      const published = await page.request.put(
        `/api/v1/admin/construction-updates/${update.id}/publication`,
        { data: {} },
      );
      expect(published.status()).toBe(200);

      await page.goto(screen);
      await waitForShell(page);
      const section = page.locator('details[data-section="construction"]');
      await section.locator("summary").click();
      const background = section.getByRole("group", { name: "Arxa fon şəkli" });
      await expect(background).toContainText("standart şəkil");
      await background.getByRole("button", { name: "Şəkil seç" }).click();
      await page
        .getByRole("dialog")
        .locator("li button", { hasText: "e2e-construction.jpg" })
        .click();
      const saved = page.waitForResponse(
        (response) => response.url().endsWith(`${api}/construction`) && response.status() === 200,
      );
      await section.getByRole("button", { name: "Yadda saxla" }).click();
      await saved;

      await page.goto("/");
      await expect(
        page.locator(`section:has(#tikinti) img[src*="/media/${item.id}/"]`),
      ).toHaveCount(1);
    } finally {
      await page.request.put(`${api}/construction`, { data: construction });
      await page.request.delete(`/api/v1/admin/construction-updates/${update.id}`);
      expect((await page.request.delete(`/api/v1/admin/media/${item.id}`)).status()).toBe(204);
    }
  });

  test("the screen has no accessibility violations, with a form open", async ({
    page,
    baseURL,
  }) => {
    await signInEditor(page, baseURL!);
    await page.goto(screen);
    await waitForShell(page);
    await page.locator('details[data-section="layouts"] summary').click();
    await expect(page.getByRole("switch", { name: "1 otaqlı: saytda göstər" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map(({ id, nodes }) => `${id}: ${nodes[0]?.html}`)).toEqual([]);
  });

  test("a role without the content permission does not get the screen", async ({
    page,
    baseURL,
  }) => {
    const email = "e2e-home-sections-sales@test.kalbajarcity.com";
    await ensureAccount("sales", email, "E2E Home Sections Sales");
    await signIn(page, email, baseURL!);
    const response = await page.goto(screen);
    await expect(page.getByRole("switch")).toHaveCount(0);
    expect(response?.status()).toBeLessThan(500);
  });
});
