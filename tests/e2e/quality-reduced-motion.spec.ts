import { expect, test, type Page } from "@playwright/test";

import { waitForHydration } from "./hydration";
import { fontsReady, horizontalOverflow, publicRoutes, withArticle } from "./public-routes";

/*
 * Every public route with `prefers-reduced-motion: reduce` (#30,
 * docs/motion-system.md → Reduced motion): no smooth scroll, nothing
 * animating, no scene pinned, and nothing left hidden, blurred or waiting for
 * an entry, at the top or after scrolling through the page. Both projects
 * run it, so the phone layout is covered too.
 */

test.use({ reducedMotion: "reduce" });

/** What is still moving, hidden or pinned under <main>, by a short description. */
function inMotion(page: Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()}.${String(element.getAttribute("class") ?? "")}`.slice(
        0,
        80,
      );

    for (const animation of document.getAnimations()) {
      if (animation.playState !== "running") continue;
      // The global reduced-motion rule (src/app/globals.css) shortens every
      // CSS transition and animation to 0.01 ms: those finish within the
      // frame they start in and move nothing. Anything longer does.
      const timing = animation.effect?.getComputedTiming();
      if (Number(timing?.activeDuration ?? 0) + Number(timing?.delay ?? 0) <= 1) continue;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const what =
        animation instanceof CSSTransition
          ? animation.transitionProperty
          : animation instanceof CSSAnimation
            ? animation.animationName
            : Object.keys((animation.effect as KeyframeEffect).getKeyframes()[0] ?? {}).join();
      found.push(`animating ${what}: ${target ? describe(target) : "unknown"}`);
    }
    for (const element of document.querySelectorAll<HTMLElement>("main *")) {
      // Things that are dim or hidden by design, not by motion: the states of
      // tests/e2e/home.spec.ts, decorative and disabled controls, the plan
      // hotspots' hover detail, a reserved apartment's plan, and the fixed
      // controls that step aside over the footer.
      if (
        element.closest(
          [
            "[data-hero-video]",
            "[data-hover-caption]",
            "[data-icon-open]",
            "[data-icon-closed]",
            "[data-preloader-overlay]",
            '[aria-hidden="true"]',
            '[aria-disabled="true"]',
            ":disabled",
            ".kompleks-detail",
            "[data-dimmed]",
            "[data-over-footer]",
          ].join(", "),
        ) ||
        element.matches('input[type="checkbox"], input[type="radio"]')
      ) {
        continue;
      }
      const style = getComputedStyle(element);
      if (Number(style.opacity) < 1) found.push(`hidden: ${describe(element)} ${style.opacity}`);
      if (style.filter.includes("blur")) found.push(`blurred: ${describe(element)}`);
      if (element.dataset.state === "out") found.push(`waiting: ${describe(element)}`);
      if (element.matches("[data-layer]") && style.position === "sticky") {
        found.push(`pinned: ${describe(element)}`);
      }
    }
    return found;
  });
}

let article: Awaited<ReturnType<typeof withArticle>>;

test.beforeAll(async ({}, testInfo) => {
  article = await withArticle(
    `http://localhost:${process.env.E2E_PORT ?? 3011}`,
    `motion-${testInfo.project.name}`,
  );
});

test.afterAll(async () => {
  await article?.remove();
});

for (const route of publicRoutes("{article}")) {
  test(`${route.name} is a still, complete page`, async ({ page }) => {
    const path = route.path.replace("{article}", article.slug);
    const response = await page.goto(path);
    expect(response?.status()).toBe(route.status);
    await waitForHydration(page);
    await fontsReady(page);

    await expect(page.locator("html")).not.toHaveClass(/lenis/);
    expect(await inMotion(page), `${path} at the top`).toEqual([]);

    // A screen at a time to the end, the way a reader scrolls.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const screen = page.viewportSize()!.height;
    for (let top = screen; top < height + screen; top += screen) {
      await page.evaluate((top) => window.scrollTo(0, top), top);
      expect(await inMotion(page), `${path} at ${top} px`).toEqual([]);
    }
    expect(await horizontalOverflow(page)).toBe(0);
  });
}
