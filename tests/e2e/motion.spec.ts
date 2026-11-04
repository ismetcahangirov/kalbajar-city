import { expect, test, type Page } from "@playwright/test";

import { interpolate } from "../../src/lib/motion/interpolate";
import { scrubEase } from "../../src/lib/motion/tokens";
import { waitForHydration } from "./hydration";

// The scroll-scene engine and its primitives (#63) on their playground.
// Reduced motion, no JavaScript and a 390 px phone must show every
// primitive in its final state as a plain stacked page; on desktop with
// motion, reveals hide only what is below the fold, scenes pin, scrubs follow
// the scroll and the hero snaps.

const playground = "/primitivler/hereket";

/**
 * Elements under <main> that are not in their final state. A scrubbed
 * element's server style (the hero panel's clip) is its final state, so a
 * value the element's own `style` attribute names is allowed; so is the
 * giant word's fixed clip.
 */
function notFinal(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("main *")) {
      const style = getComputedStyle(element);
      const inline = element.getAttribute("style") ?? "";
      const name = `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 80);
      if (Number(style.opacity) < 1) found.push(`${name} opacity ${style.opacity}`);
      if (style.translate !== "none" && !inline.includes("translate")) {
        found.push(`${name} translate ${style.translate}`);
      }
      if (
        style.clipPath !== "none" &&
        !inline.includes("clip-path") &&
        !element.matches("[data-split-word], .sr-only")
      ) {
        found.push(`${name} clip-path ${style.clipPath}`);
      }
      if (element.matches("[data-layer]") && style.position === "sticky") {
        found.push(`${name} is pinned`);
      }
      if (element.dataset.state === "out") found.push(`${name} waits for its entry`);
    }
    if (document.querySelector("[data-swap]")) found.push("the stats are swapping");
    return found;
  });
}

async function scrollToEnd(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

/** The document top of the scene with this test id, from the offset chain. */
function sceneTop(page: Page, testId: string) {
  return page.evaluate((id) => {
    let node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    let top = 0;
    while (node) {
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return top;
  }, testId);
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("every primitive renders its final state, stacked", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await notFinal(page)).toEqual([]);

    await scrollToEnd(page);
    await page.waitForTimeout(300);
    expect(await notFinal(page)).toEqual([]);
    await expect(page.locator("[data-split-word] [style]")).toHaveCount(0);
    await expect(page.locator("[data-follow]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
    // The hero panel keeps its server clip, the right third.
    await expect(page.getByTestId("hero-panel")).toHaveAttribute("style", /66\.66%/);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every primitive renders its final state, stacked", async ({ page }) => {
    await page.goto(playground);
    expect(await notFinal(page)).toEqual([]);
    // Every set of stats is its own row; every grapheme its own letter.
    await expect(page.locator("[data-stat-set]")).toHaveCount(2);
    await expect(page.locator("[data-stat-set]").nth(1)).toBeVisible();
    await expect(page.locator('[data-split-word="explode"] [data-letter]')).toHaveCount(5);
    await expect(page.getByRole("heading", { name: "Kəlbəcər, İstisu və Şəlalə" })).toBeVisible();
    await expect(page.getByText("Dağların qoynunda, şəlalələrin səsində")).toBeVisible();
  });
});

test.describe("at 390 px on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("is a static stacked page without horizontal scroll", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    await scrollToEnd(page);
    await page.waitForTimeout(300);
    // The staircase keeps its scrub on touch (its mobile variant), so its
    // letters carry inline styles; everything else is untouched.
    expect(await notFinal(page)).toEqual([]);
    await expect(page.locator("[data-reveal][data-state]")).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe("with motion on a desktop", () => {
  test.skip(({ isMobile }) => isMobile, "desktop motion only");

  test("hides only what is below the fold and reveals it on entry", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    await page.evaluate(() => document.fonts.ready);

    // Below the fold: waiting, split into lines, one accessible string.
    const text = page.getByTestId("reveal-text");
    await expect(text).toHaveAttribute("data-state", "out");
    await expect(text.locator("[data-line]").first()).toBeAttached();
    await expect(text.locator(".sr-only")).toHaveText(/^Dağların qoynunda/);
    await expect(page.getByTestId("reveal-image")).toHaveAttribute("data-state", "out");
    await expect(page.getByTestId("columns").locator("li").first()).toHaveAttribute(
      "data-state",
      "out",
    );

    await text.scrollIntoViewIfNeeded();
    await expect(text).toHaveAttribute("data-state", "in");
    // A one-time reveal hands the element back in its own nodes.
    await expect(text.locator("[data-line]")).toHaveCount(0, { timeout: 5000 });
    await expect(text).not.toHaveAttribute("data-state");

    // The last block enters at the end of the page.
    await scrollToEnd(page);
    await expect(page.getByTestId("last-text")).not.toHaveAttribute("data-state", "out", {
      timeout: 5000,
    });
  });

  test("pins scenes and scrubs the iris with the scroll, both ways", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    const layer = page.getByTestId("iris-scene").locator("> [data-layer]");
    await expect(layer).toHaveCSS("position", "sticky");

    const top = await sceneTop(page, "iris-scene");
    const vh = await page.evaluate(() => window.innerHeight);
    const iris = interpolate(
      "inset(50svh 50% calc(100% - 50svh) 50%)",
      "inset(0 0 calc(100% - 100svh) 0)",
    );
    const clipAt = async (share: number) => {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(top + share * vh));
      // Serialized by the browser, which shortens inset() as it does the written value.
      const expected = await page.evaluate(
        (value) => {
          const probe = document.createElement("div");
          probe.style.clipPath = value;
          return probe.style.clipPath;
        },
        iris(scrubEase.quadIn(Math.round(share * vh) / vh)),
      );
      expect(expected).toMatch(/^inset\(/);
      await expect
        .poll(() =>
          page.getByTestId("iris").evaluate((element) => (element as HTMLElement).style.clipPath),
        )
        .toBe(expected);
    };
    await clipAt(0.75);
    await clipAt(0.25);

    // The stats swap sets at their points and draw their lines.
    const stats = page.getByTestId("stats");
    await expect(stats).toHaveAttribute("data-swap", "");
    await expect(stats).toHaveAttribute("data-lines", "out");
    await page.evaluate((y) => window.scrollTo(0, y), top + 1.5 * vh);
    await expect(stats).toHaveAttribute("data-lines", "in");
    await expect(stats.locator("[data-stat-set]").first()).toHaveAttribute("data-row-state", "in");
    await page.evaluate((y) => window.scrollTo(0, y), top + 2.5 * vh);
    await expect(stats.locator("[data-stat-set]").nth(1)).toHaveAttribute("data-row-state", "in");
    await expect(stats.locator("[data-stat-set]").first()).toHaveAttribute(
      "data-row-state",
      "before",
    );
  });

  test("snaps the hero forward on a wheel turn", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    await expect(page.locator("html")).toHaveClass(/lenis/);
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 240);
    const vh = await page.evaluate(() => window.innerHeight);
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 })
      .toBe(vh);
  });

  test("follows the pointer over the teaser", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    const teaser = page.getByTestId("teaser");
    await teaser.scrollIntoViewIfNeeded();
    await expect(teaser).toHaveAttribute("data-follow", "");
    const box = (await teaser.boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.move(box.x + 120, box.y + 110);
    await expect(teaser).toHaveAttribute("data-state", "in");
    await expect(teaser.locator("[data-follower]")).toHaveAttribute("style", /translate\(/);
  });
});
