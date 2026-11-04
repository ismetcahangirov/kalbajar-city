import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { leads } from "@/db/schema";
import az from "@/i18n/messages/az.json";

import { waitForHydration } from "./hydration";
import { localized, publicRoutes, withArticle } from "./public-routes";

/*
 * The keyboard alone (#30, CLAUDE.md → Accessibility). Every public route is
 * walked with Tab from the top to the end: each stop is on screen, visible
 * and shows a focus indicator, and focus never falls back to the page body
 * on the way. Then the main journey, home → catalogue → apartment →
 * inquiry, is made without a pointer.
 *
 * The menu's focus trap, the catalogue filters, the plan selector, the
 * lightbox and the forms each have their own keyboard tests next to their
 * features (shell, catalogue-filters, complex, content and leads specs).
 */

type Stop = {
  name: string;
  visible: boolean;
  onScreen: boolean;
  indicator: boolean;
  box: { x: number; y: number; width: number; height: number };
};

/**
 * The focused element, described, and whether it can be seen and shows that
 * it has focus. A focus indicator is anything that looks different with
 * focus than without: the ring of src/app/globals.css, or a component's own
 * cue, which may sit on the element, inside it, on a `peer` sibling (the
 * custom checkbox draws its box next to a transparent native input) or on a
 * card around it (`focus-within`, the stretched-link cards). So the styles
 * that can carry a cue are read with focus, again after a blur, and
 * compared; then focus is put back for the next Tab. A cue that styles
 * cannot show (a range input's thumb is a pseudo-element of its own) is
 * found by `looksFocused`, from pixels.
 */
function focusedStop(page: Page): Promise<Stop | null> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const label =
      element.getAttribute("aria-label") ??
      element.getAttribute("name") ??
      element.id ??
      element.textContent ??
      "";
    const name = `${element.tagName.toLowerCase()} "${label.trim().slice(0, 40)}"`;

    // A transparent native input stands for the control drawn next to it.
    const peer = element.matches("input.peer") ? element.nextElementSibling : null;
    const shown = (peer as HTMLElement | null) ?? element;
    const box = shown.getBoundingClientRect();
    let opacity = 1;
    for (let node: Element | null = shown; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    const visible =
      box.width > 0 &&
      box.height > 0 &&
      opacity > 0.5 &&
      getComputedStyle(shown).visibility !== "hidden";
    const onScreen =
      box.bottom > 0 &&
      box.top < window.innerHeight &&
      box.right > 0 &&
      box.left < window.innerWidth;

    const related: Element[] = [element, ...element.querySelectorAll("*")].slice(0, 40);
    for (let sibling = element.nextElementSibling, i = 0; sibling && i < 2; i++) {
      related.push(sibling, ...sibling.querySelectorAll("*"));
      sibling = sibling.nextElementSibling;
    }
    for (let parent = element.parentElement, i = 0; parent && i < 4; i++) {
      related.push(parent);
      parent = parent.parentElement;
    }
    const properties = [
      "outline-style",
      "outline-width",
      "outline-color",
      "box-shadow",
      "border-color",
      "background-color",
      "color",
      "text-decoration-line",
      "fill",
      "stroke",
      "opacity",
    ];
    const snapshot = () =>
      related
        .flatMap((node) =>
          [null, "::before", "::after"].map((pseudo) => {
            const style = getComputedStyle(node, pseudo);
            return properties.map((property) => style.getPropertyValue(property)).join("|");
          }),
        )
        .join("\n");
    const focused = snapshot();
    // Focus moves to a throwaway element rather than `blur()`: a phone's
    // date-time input keeps focus inside itself on blur.
    const sink = document.createElement("span");
    sink.tabIndex = -1;
    sink.style.position = "fixed";
    document.body.append(sink);
    sink.focus({ preventScroll: true });
    const blurred = snapshot();
    element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    sink.remove();
    return {
      name,
      visible,
      onScreen,
      indicator: focused !== blurred,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  });
}

/** Whether the area around the focused element looks different without focus. */
async function looksFocused(page: Page, box: Stop["box"]): Promise<boolean> {
  const viewport = page.viewportSize()!;
  const x = Math.max(0, box.x - 8);
  const y = Math.max(0, box.y - 8);
  const clip = {
    x,
    y,
    width: Math.max(1, Math.min(viewport.width - x, box.width + 16)),
    height: Math.max(1, Math.min(viewport.height - y, box.height + 16)),
  };
  const focused = await page.screenshot({ clip, animations: "disabled" });
  const element = await page.evaluateHandle(() => document.activeElement as HTMLElement);
  await element.evaluate(() => {
    const sink = document.createElement("span");
    sink.tabIndex = -1;
    sink.style.position = "fixed";
    sink.dataset.focusSink = "";
    document.body.append(sink);
    sink.focus({ preventScroll: true });
  });
  const blurred = await page.screenshot({ clip, animations: "disabled" });
  await element.evaluate((node) => {
    node.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    document.querySelector("[data-focus-sink]")?.remove();
  });
  await element.dispose();
  return !focused.equals(blurred);
}

let article: Awaited<ReturnType<typeof withArticle>>;

test.beforeAll(async ({}, testInfo) => {
  article = await withArticle(
    `http://localhost:${process.env.E2E_PORT ?? 3011}`,
    `keyboard-${testInfo.project.name}`,
  );
});

test.afterAll(async () => {
  await article?.remove();
});

// Two locales: the tab order does not depend on the language, but text length does.
for (const locale of ["az", "ru"] as const) {
  for (const route of publicRoutes("{article}")) {
    test(`${route.name} in ${locale}: every Tab stop is visible and shows focus`, async ({
      page,
    }) => {
      const path = localized(locale, route.path.replace("{article}", article.slug));
      await page.goto(path);
      await waitForHydration(page);

      const problems: string[] = [];
      let stops = 0;
      for (; stops < 250; stops++) {
        await page.keyboard.press("Tab");
        // A date-time input takes one Tab per part (day, month, year …).
        // Measuring puts focus back on the element, which restarts at its
        // first part, so each element is measured once.
        const same = await page.evaluate(() => {
          const element = document.activeElement as (Element & { __walked?: boolean }) | null;
          if (!element || element === document.body) return false;
          const seen = element.__walked === true;
          element.__walked = true;
          return seen;
        });
        if (same) continue;
        const stop = await focusedStop(page);
        // Past the last stop focus leaves the document: the walk is complete.
        if (!stop) break;
        if (!stop.visible) problems.push(`${stop.name} is not visible`);
        else if (!stop.onScreen) problems.push(`${stop.name} is off screen`);
        if (!stop.indicator && !(stop.onScreen && (await looksFocused(page, stop.box))))
          problems.push(`${stop.name} shows no focus indicator`);
      }
      expect(stops, `${path}: the walk ends`).toBeLessThan(250);
      expect(stops, `${path}: there is something to reach`).toBeGreaterThan(3);
      expect(problems, path).toEqual([]);
    });
  }
}

test.describe("the inquiry journey", () => {
  test.skip(({ isMobile }) => isMobile, "a keyboard journey; the phone layout has its own tests");

  test("goes from home to an apartment's inquiry without a pointer", async ({ page }, testInfo) => {
    const octet = Math.floor(Math.random() * 250) + 1;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${octet}.${octet}` });

    /** Presses Tab until `target` has focus. */
    async function tabTo(target: Locator) {
      for (let i = 0; i < 200; i++) {
        if (await target.evaluate((element) => element === document.activeElement)) return;
        await page.keyboard.press("Tab");
      }
      throw new Error("Tab never reached the element");
    }
    async function activate(target: Locator) {
      await tabTo(target);
      await page.keyboard.press("Enter");
    }

    await page.goto("/");
    await waitForHydration(page);
    await activate(page.getByRole("banner").getByRole("link", { name: az.Shell.chooseApartment }));
    await expect(page).toHaveURL(/\/menziller$/);
    await waitForHydration(page);

    await activate(page.locator('main a[href^="/menziller/"]').first());
    await expect(page).toHaveURL(/\/menziller\/[a-z0-9-]+$/);
    await waitForHydration(page);
    const apartment = new URL(page.url()).pathname;

    await activate(page.getByRole("banner").getByRole("link", { name: az.Shell.inquire }));
    const dialog = page.getByRole("dialog", { name: az.Shell.inquire });
    await expect(dialog).toBeVisible();
    const shown = Date.now();

    const name = `E2E keyboard ${testInfo.project.name}-${randomUUID().slice(0, 8)}`;
    await tabTo(dialog.getByLabel(az.LeadForm.name));
    await page.keyboard.type(name);
    await tabTo(dialog.getByLabel(az.LeadForm.phone));
    await page.keyboard.type("050 123 45 67");
    await tabTo(dialog.getByRole("checkbox"));
    await page.keyboard.press("Space");
    await expect(dialog.getByRole("checkbox")).toBeChecked();
    // The form's time trap drops anything sent within three seconds.
    await page.waitForTimeout(Math.max(0, 3500 - (Date.now() - shown)));
    await activate(dialog.getByRole("button", { name: az.LeadForm.submit.inquiry }));
    await expect(dialog.getByText(az.LeadForm.success.title)).toBeFocused();

    const { db, close } = connect(databaseUrl());
    try {
      const [row] = await db.select().from(leads).where(eq(leads.name, name));
      expect(row).toMatchObject({ type: "inquiry", sourcePath: apartment });
      await db.delete(leads).where(eq(leads.name, name));
    } finally {
      await close();
    }
  });
});
