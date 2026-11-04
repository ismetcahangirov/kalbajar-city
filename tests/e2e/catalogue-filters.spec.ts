import { expect, test, type Locator, type Page } from "@playwright/test";

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

/** The number of apartments the results' header announces. */
async function shownTotal(page: Page): Promise<number> {
  const text = await page
    .getByRole("region", { name: "Nəticələr" })
    .getByRole("status")
    .textContent();
  return Number(text!.match(/^\d+/)![0]);
}

test.describe("the mobile filter dialog", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, counts the choice before applying it, applies and resets", async ({ page }) => {
    await page.goto("/menziller");
    await waitForHydration(page);
    const total = await shownTotal(page);

    // Below `lg` the filter column is a fixed button, not a sidebar.
    await expect(page.getByRole("complementary", { name: "Filtr" })).toBeHidden();
    const open = page.getByRole("button", { name: /^Filtr/ });
    await expect(open).toBeInViewport();
    await open.click();
    const dialog = page.getByRole("dialog", { name: "Filtr" });
    await expect(dialog).toBeVisible();
    await expectNoHorizontalScroll(page);

    const apply = dialog.getByRole("button", { name: /mənzili göstər$/ });
    await expect(apply).toHaveText(`${total} mənzili göstər`);
    await expect(apply).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Sıfırla" })).toBeInViewport();

    await dialog.getByRole("group", { name: "Otaq sayı" }).getByLabel("2", { exact: true }).check();
    // The live count for the draft replaces the applied one.
    await expect(apply).not.toHaveText(`${total} mənzili göstər`);
    await expect(apply).toHaveText(/^\d+ mənzili göstər$/);
    const count = Number((await apply.textContent())!.match(/^\d+/)![0]);
    expect(count).toBeLessThan(total);

    await apply.click();
    await expect(page).toHaveURL(/\/menziller\?otaq=2$/);
    await expect(dialog).toBeHidden();
    expect(await shownTotal(page)).toBe(count);
    // One filter is applied: the button says so.
    await expect(open).toHaveAccessibleName(/1 filtr seçilib/);

    // "Reset" clears the draft; the count goes back to every apartment.
    await open.click();
    const rooms = dialog.getByRole("group", { name: "Otaq sayı" }).getByLabel("2", { exact: true });
    await expect(rooms).toBeChecked();
    await dialog.getByRole("button", { name: "Sıfırla" }).click();
    await expect(rooms).not.toBeChecked();
    await expect(apply).toHaveText(`${total} mənzili göstər`);
    await apply.click();
    await expect(page).toHaveURL(/\/menziller$/);
    expect(await shownTotal(page)).toBe(total);
  });
});

test.describe("the filter controls with the keyboard alone", () => {
  test.skip(({ isMobile }) => isMobile, "the sidebar is the desktop layout");

  test("Segmented toggles with Space and RangeHairline moves with the arrows", async ({ page }) => {
    await page.goto("/menziller");
    await waitForHydration(page);
    const filters = page.getByRole("complementary", { name: "Filtr" });

    // Segmented: each cell is a checkbox in the tab order.
    const three = filters
      .getByRole("group", { name: "Otaq sayı" })
      .getByRole("checkbox", { name: "3", exact: true });
    await tabTo(page, three);
    await page.keyboard.press("Space");
    await expect(three).toBeChecked();
    await page.keyboard.press("Space");
    await expect(three).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(three).toBeChecked();

    // RangeHairline: the ticks are sliders that write into the fields.
    const area = filters.getByRole("group", { name: "Sahə, m²" });
    const minField = area.getByRole("spinbutton", { name: "Sahə, m²: Ən az" });
    const maxField = area.getByRole("spinbutton", { name: "Sahə, m²: Ən çox" });
    const minSlider = area.getByRole("slider", { name: "Sahə, m²: Ən az, sürgü" });
    const maxSlider = area.getByRole("slider", { name: "Sahə, m²: Ən çox, sürgü" });
    await expect(minField).toHaveValue("");
    const lowest = Number(await minSlider.getAttribute("min"));
    const highest = Number(await maxSlider.getAttribute("max"));

    await tabTo(page, minSlider);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const from = Number(await minField.inputValue());
    expect(from).toBeCloseTo(lowest + 2, 2);
    // Home takes the tick back to its end, which clears the bound.
    await page.keyboard.press("Home");
    await expect(minField).toHaveValue("");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(minField).toHaveValue(String(from));

    await tabTo(page, maxSlider);
    await page.keyboard.press("ArrowLeft");
    const to = Number(await maxField.inputValue());
    expect(to).toBeLessThan(highest);
    expect(to).toBeGreaterThan(from);
    // The lower tick never passes the upper one.
    await minSlider.focus();
    await page.keyboard.press("End");
    expect(Number(await minField.inputValue())).toBeLessThanOrEqual(to);
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    const apply = filters.getByRole("button", { name: /mənzili göstər$/ });
    await expect(apply).toHaveText(/^\d+ mənzili göstər$/);
    await tabTo(page, apply);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/menziller\\?otaq=3&sahe-min=${from}&sahe-max=${to}$`.replaceAll(".", "\\.")),
    );
    const titles = await page
      .getByRole("region", { name: "Nəticələr" })
      .getByRole("heading", { level: 3 })
      .allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((title) => title.startsWith("3 otaq"))).toBe(true);
  });
});
