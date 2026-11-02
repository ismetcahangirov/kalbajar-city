import { expect, test, type Locator, type Page } from "@playwright/test";

import { ensureAccount, signIn, waitForShell } from "./console";

type AdminItem = { id: string; slug: string; number: string; block: string; status: string };

/** Each test signs in as an account of its own, so parallel tests never share a session. */
async function signInAsOwner(page: Page, name: string, project: string, baseURL: string) {
  const email = `e2e-inventory-${name}-${project}@test.kalbajarcity.com`;
  await ensureAccount("owner", email, "E2E Inventory Owner");
  await signIn(page, email, baseURL);
}

/** Presses Tab until `target` has focus, as a keyboard user would. */
async function tabTo(page: Page, target: Locator, limit = 120) {
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${String(target)}`);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Each viewport changes an apartment of its own block (other files use A and I)
// and puts it back, so the two projects never touch the same row.
test.describe("bulk status change", () => {
  test.describe.configure({ mode: "serial" });

  test("by keyboard only, visible in the public catalogue on the next request", async ({
    page,
    baseURL,
    isMobile,
  }, info) => {
    const block = isMobile ? "H" : "G";
    await signInAsOwner(page, "bulk", info.project.name, baseURL!);
    const listed = await page.request.get(
      `/api/v1/admin/apartments?block=${block}&status=available&pageSize=1`,
    );
    const [target] = ((await listed.json()) as { items: AdminItem[] }).items;
    expect(target, `the seed has available apartments in block ${block}`).toBeTruthy();
    const name = `${target!.block}-${target!.number}`;

    // Warm the catalogue's cache, so a stale copy would be what the next read gets.
    await page.goto(`/menziller?blok=${block}`);
    const card = page
      .locator("article")
      .filter({ has: page.locator(`a[href$="/menziller/${target!.slug}"]`) });
    await expect(card).toContainText("Satışda");

    try {
      await page.goto(`/admin/menziller?blok=${block}&status=available`);
      await waitForShell(page);
      expect(await overflow(page)).toBe(0);

      const checkbox = page.getByRole("checkbox", { name: `Seç: ${name}`, exact: true });
      await tabTo(page, checkbox);
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked();

      const bar = page.getByRole("region", { name: /^Toplu əməliyyatlar/ });
      await expect(bar).toContainText("1 mənzil seçilib");
      expect(await overflow(page)).toBe(0);

      const status = bar.getByRole("combobox", { name: "Yeni status" });
      await tabTo(page, status);
      await page.keyboard.press("Enter");
      const sold = page.getByRole("option", { name: "Satılıb" });
      await expect(sold).toBeVisible();
      for (let step = 0; step < 6; step++) {
        if (await sold.evaluate((element) => element === document.activeElement)) break;
        await page.keyboard.press("ArrowDown");
      }
      await page.keyboard.press("Enter");
      await expect(status).toHaveText("Satılıb");

      await tabTo(page, bar.getByRole("button", { name: "Statusu dəyiş" }));
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("1 mənzilin statusu “Satılıb” olsun?");
      await tabTo(page, dialog.getByRole("button", { name: "Tətbiq et" }), 5);
      await page.keyboard.press("Enter");
      await expect(page.getByText("1 mənzil yeniləndi.")).toBeVisible();
      await expect(bar).toBeHidden();

      await page.goto(`/menziller?blok=${block}`);
      await expect(card).toContainText("Satılıb");
    } finally {
      const restored = await page.request.patch(`/api/v1/admin/apartments/${target!.id}`, {
        data: { status: "available" },
      });
      expect(restored.status()).toBe(200);
    }
  });
});

test("the CSV template downloads, and the import preview lists an invalid row by line", async ({
  page,
  baseURL,
}, info) => {
  await signInAsOwner(page, "import", info.project.name, baseURL!);
  await page.goto("/admin/menziller/idxal");
  await waitForShell(page);
  expect(await overflow(page)).toBe(0);

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Şablonu yüklə" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("menziller-sablon.csv");
  const template = (await (await file.createReadStream()).toArray()).join("");
  const [header, example] = template.replace(/^﻿/, "").trim().split("\r\n");
  expect(header).toBe("Blok;Mərtəbə;Mənzil;Plan;Sahə (m²);Status;Qiymət (AZN)");
  expect(example).toMatch(/^A;1;101;[^;]+;[\d,]+;satışda;$/);

  // The template's example and one row that is wrong three ways.
  const csv = `${template.trim()}\r\nA;2;xx!;nope;0;bilinmir;\r\n`;
  await page.getByLabel("CSV faylı").setInputFiles({
    name: "menziller.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });
  await page.getByRole("radio", { name: /^Yenilə və ya əlavə et/ }).check();
  await page.getByRole("button", { name: "Yoxla (sınaq)" }).click();

  const report = page.getByRole("region", { name: /problem var: heç nə yazılmayacaq$/ });
  await expect(report).toBeVisible();
  const issues = report.getByRole("table", { name: "Faylın problemləri, sətir nömrəsi ilə" });
  const rows = issues.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) await expect(row.getByRole("rowheader")).toHaveText("3");
  await expect(issues).toContainText("Mənzil nömrəsi düzgün deyil: “xx!”.");
  await expect(issues).toContainText("Naməlum status: “bilinmir”.");
  await expect(page.getByRole("button", { name: "İdxal et" })).toBeDisabled();
  expect(await overflow(page)).toBe(0);
});
