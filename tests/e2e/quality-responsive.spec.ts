import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  fontsReady,
  horizontalOverflow,
  localized,
  locales,
  publicRoutes,
  withArticle,
} from "./public-routes";

/*
 * Every public route in every locale at every width from 320 to 1920 px
 * (#30, CLAUDE.md → Responsiveness): the page never scrolls sideways, at the
 * top or anywhere further down, where pinned scenes and reveals move things.
 * A viewport screenshot of each is saved under test-results/responsive for
 * review; CI uploads them as an artifact.
 *
 * Phone and tablet widths run as a touch device, desktop widths with a
 * mouse, so each width gets the layout and the motion paths its devices
 * get. The viewports are set here, so the file runs in the desktop project
 * only.
 */

const devices = [
  { width: 320, height: 640, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1024, height: 768, touch: false },
  { width: 1440, height: 900, touch: false },
  { width: 1920, height: 1080, touch: false },
] as const;

/** Scrolls the page to its end a screen at a time; returns the widest overflow seen. */
async function overflowWhileScrolling(page: Page): Promise<number> {
  let widest = await horizontalOverflow(page);
  for (let step = 1; step <= 40; step++) {
    const done = await page.evaluate((step) => {
      const target = step * window.innerHeight;
      window.scrollTo({ top: target, behavior: "instant" });
      return target >= document.documentElement.scrollHeight - window.innerHeight;
    }, step);
    // Two frames, so scroll-driven styles are applied before measuring.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    widest = Math.max(widest, await horizontalOverflow(page));
    if (done) break;
  }
  return widest;
}

let article: Awaited<ReturnType<typeof withArticle>>;

test.skip(() => test.info().project.name !== "desktop", "each width sets its own viewport");

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== "desktop") return;
  article = await withArticle(`http://localhost:${process.env.E2E_PORT ?? 3011}`, "responsive");
});

test.afterAll(async () => {
  await article?.remove();
});

for (const { width, height, touch } of devices) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height }, isMobile: touch, hasTouch: touch });

    for (const locale of locales) {
      for (const route of publicRoutes("{article}")) {
        test(`${route.name} in ${locale} has no horizontal scroll`, async ({ page }) => {
          const path = localized(locale, route.path.replace("{article}", article.slug));
          const response = await page.goto(path);
          expect(response?.status()).toBe(route.status);
          await fontsReady(page);

          expect(await horizontalOverflow(page), `${path} at the top`).toBe(0);
          await page.screenshot({
            path: join(
              test.info().project.outputDir,
              "responsive",
              locale,
              `${route.name}-${width}.png`,
            ),
          });
          expect(await overflowWhileScrolling(page), `${path} further down`).toBe(0);
        });
      }
    }
  });
}
