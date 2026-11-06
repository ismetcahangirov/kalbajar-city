import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { ensureAccount, signIn, waitForShell } from "./console";

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const savedOrder = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/admin/faq/order") && response.request().method() === "PUT",
  );

// The question is a draft, so the public FAQ (and the tests that read it) never
// sees it. One project only: two runs reordering the same list would race.
test("an editor adds a question and reorders it by button and by keyboard on a phone", async ({
  page,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "mobile", "The FAQ list is shared; one project reorders it.");
  const email = `e2e-faq-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("editor", email, "E2E FAQ Editor");
  await signIn(page, email, baseURL!);

  await page.goto("/admin/xeberler/suallar");
  await waitForShell(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tez-tez verilən suallar");
  const nav = page.getByRole("navigation", { name: "Məzmunun bölmələri" });
  await expect(nav.getByRole("link", { name: "Suallar" })).toHaveAttribute("aria-current", "page");

  const question = `E2E sual ${randomUUID().slice(0, 6)}?`;
  await page.getByRole("button", { name: "Yeni sual" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Sual (Azərbaycanca)").fill(question);
  const shown = dialog.getByRole("switch", { name: "Saytda göstər" });
  await expect(shown).toBeChecked();
  await shown.click();
  // The facts an answer can quote are listed; a misspelt one is refused on its field.
  await expect(dialog.getByRole("region", { name: "Rəqəmlər üçün dəyişənlər" })).toContainText(
    "{apartments}",
  );
  const answer = dialog.getByLabel("Cavab (Azərbaycanca)");
  await answer.fill("Cəmi {flats} mənzil.");
  await dialog.getByRole("button", { name: "Əlavə et" }).click();
  await expect(dialog.getByText("Naməlum dəyişən: {flats}.")).toBeVisible();
  await answer.fill("Cəmi {apartments} mənzil.");
  await dialog.getByRole("button", { name: "Əlavə et" }).click();
  await expect(dialog).toBeHidden();

  const list = page.getByRole("list", { name: "Suallar" });
  const titles = () => list.locator(":scope > li h3").allTextContents();
  await expect(list.getByText(question)).toBeVisible();
  await expect(
    list.locator("li", { hasText: question }).getByText("Saytda gizlidir"),
  ).toBeVisible();
  const start = (await titles()).indexOf(question);
  expect(start).toBe((await titles()).length - 1);
  expect(await overflow(page)).toBe(0);

  // One step up with the button; focus stays on the moved row.
  const up = page.getByRole("button", { name: `Yuxarı apar: ${question}` });
  const moved = savedOrder(page);
  await up.click();
  expect((await moved).status()).toBe(200);
  await expect.poll(async () => (await titles()).indexOf(question)).toBe(start - 1);
  await expect(page.getByRole("button", { name: `Yuxarı apar: ${question}` })).toBeFocused();

  await page.reload();
  await waitForShell(page);
  await expect.poll(async () => (await titles()).indexOf(question)).toBe(start - 1);

  // Back down with the keyboard: Space picks the row up, an arrow moves it, Space drops it.
  const handle = page.getByRole("button", { name: `Sürüşdürüb sırasını dəyiş: ${question}` });
  await handle.focus();
  const dropped = savedOrder(page);
  await page.keyboard.press("Space");
  // dnd-kit's keyboard sensor listens for arrows from a `setTimeout` queued at
  // the pick-up; an arrow sent before it runs is lost and the row stays put.
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)));
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("status").filter({ hasText: `${question}: indi ${start + 1}-ci yerdədir` }),
  ).toHaveCount(1);
  await page.keyboard.press("Space");
  expect((await dropped).status()).toBe(200);
  await expect.poll(async () => (await titles()).indexOf(question)).toBe(start);

  await page.getByRole("button", { name: `Sil: ${question}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sualı sil" }).click();
  await expect(list.getByText(question)).toHaveCount(0);
});

test("the gallery screen opens in the content module without horizontal scroll", async ({
  page,
  baseURL,
}, info) => {
  const email = `e2e-gallery-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("editor", email, "E2E Gallery Editor");
  await signIn(page, email, baseURL!);

  await page.goto("/admin/xeberler/qalereya");
  await waitForShell(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qalereya");
  await expect(page.getByRole("heading", { name: "Kateqoriyalar" })).toBeVisible();
  expect(await overflow(page)).toBe(0);
});
