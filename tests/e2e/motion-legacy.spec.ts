import { expect, test, type Page } from "@playwright/test";

import { waitForHydration } from "./hydration";

// The legacy motion primitives (#16) on their playground, kept until #66 and
// #68 replace their last uses. With reduced motion and
// without JavaScript every primitive must render its final state; with motion
// on, entries must hide only what is below the fold and end in that state.

const playground = "/primitivler/hereket/kohne";

/**
 * Elements under <main> that are not in their final state: transparent,
 * shifted or clipped. Scroll-scrubbed layers (parallax media, pinned scenes)
 * are positioned by design and are skipped when `includeScrubbed` is false.
 */
function notFinal(page: Page, includeScrubbed = true) {
  return page.evaluate((scrubbed) => {
    const found: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("main *")) {
      if (!scrubbed && element.closest("[data-parallax-media], [data-pinned]")) continue;
      const style = getComputedStyle(element);
      const name = `${element.tagName.toLowerCase()}[${element.getAttribute("data-motion") ?? element.className}]`;
      if (Number(style.opacity) < 1) found.push(`${name} opacity ${style.opacity}`);
      if (style.translate !== "none") found.push(`${name} translate ${style.translate}`);
      if (style.clipPath !== "none") found.push(`${name} clip-path ${style.clipPath}`);
    }
    if (document.querySelector("[data-line]")) found.push("a LineReveal heading is still split");
    return found;
  }, includeScrubbed);
}

async function scrollToEnd(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 300) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("every primitive renders its final state", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await notFinal(page)).toEqual([]);

    await scrollToEnd(page);
    expect(await notFinal(page)).toEqual([]);
    await expect(page.locator("[data-pinned]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every primitive renders its final state", async ({ page }) => {
    await page.goto(playground);
    expect(await notFinal(page)).toEqual([]);
    await expect(page.getByText("Wide image")).toBeVisible();
    await expect(page.locator("[data-scene]")).toHaveCount(4);
  });
});

test.describe("with motion", () => {
  test("hides only what is below the fold and ends in the final state", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);

    // Above the fold: never hidden. Below it: waiting for its entry.
    await expect(page.getByTestId("above-fold")).toHaveCSS("opacity", "1");
    await expect(page.getByTestId("last-block")).toHaveCSS("opacity", "0");
    await expect(page.locator("[data-pinned]")).toHaveCount(1);

    await scrollToEnd(page);
    // The slowest entry (CountUp) runs 1.6 s.
    await expect.poll(() => notFinal(page, false), { timeout: 5000 }).toEqual([]);

    // CountUp lands on the locale-formatted value and drops its counting copy.
    await expect(page.locator("[data-stat-value='22634']")).toHaveText("22 634");
    await expect(page.locator("[data-motion='count-up'] [aria-hidden]").first()).toBeHidden();
  });

  test("restores a split heading with its accessible text", async ({ page }) => {
    await page.goto(playground);
    await waitForHydration(page);
    const heading = page.getByRole("heading", { name: /Dağların qoynunda/ });
    await expect(heading).toHaveAttribute("aria-label", /yeni ev/);

    await heading.scrollIntoViewIfNeeded();
    await expect(heading.locator("em")).toHaveText("yeni ev");
    await expect(heading).not.toHaveAttribute("aria-label");
  });

  test("smooth scrolls only with a fine pointer", async ({ page }, testInfo) => {
    await page.goto(playground);
    await waitForHydration(page);
    const fine = await page.evaluate(() => matchMedia("(pointer: fine)").matches);
    test.skip(
      testInfo.project.name === "mobile" && fine,
      "the emulated phone reports a fine pointer",
    );
    if (fine) await expect(page.locator("html")).toHaveClass(/lenis/);
    else await expect(page.locator("html")).not.toHaveClass(/lenis/);
  });
});
