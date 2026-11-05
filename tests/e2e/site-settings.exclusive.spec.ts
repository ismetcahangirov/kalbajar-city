import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import type { AdminSeoOverride } from "@/shared/seo-overrides";

import { ensureAccount, signIn, waitForShell } from "./console";
import { flaggedPaths, patchContacts, readContacts, restoreFlags } from "./settings";

/*
 * These change what every page shows, so they run in the `exclusive`
 * project, after every other spec (playwright.config.ts).
 */

async function signInOwner(page: Page, baseURL: string) {
  const email = "e2e-site-settings@test.kalbajarcity.com";
  await ensureAccount("owner", email, "E2E Site Settings Owner");
  await signIn(page, email, baseURL);
}

/** The JSON-LD of a page, as one string. */
async function structuredData(request: APIRequestContext, path: string): Promise<string> {
  const html = await (await request.get(path)).text();
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((match) => match[1])
    .join("\n");
}

test("a new main phone shows in the header, footer, contact page and structured data on the next request", async ({
  page,
  baseURL,
}) => {
  await signInOwner(page, baseURL!);
  const original = (await readContacts(page.request)).phones;
  const flags = await flaggedPaths();
  const phone = "+994125550101";
  const tel = `a[href="tel:${phone}"]`;

  try {
    await page.goto("/admin/ayarlar");
    await waitForShell(page);
    const main = page
      .getByRole("group", { name: "Telefonlar" })
      .getByRole("listitem", { name: "Əsas telefon" });
    await main.getByRole("textbox", { name: "Nömrə" }).fill(phone);
    await page.getByRole("button", { name: "Yadda saxla" }).click();
    await expect(page.getByText("Ayarlar yadda saxlanıldı")).toBeVisible();

    await page.goto("/");
    await expect(page.locator(`header ${tel}`).first()).toBeAttached();
    await expect(page.locator(`#site-footer ${tel}`)).toHaveCount(1);
    await expect(page.locator(`#site-menu ${tel}`).first()).toBeAttached();

    await page.goto("/en/elaqe");
    await expect(page.locator(`main ${tel}`)).toHaveCount(1);
    expect(await structuredData(page.request, "/elaqe")).toContain(`"telephone":"${phone}"`);
  } finally {
    await patchContacts(page.request, { phones: original });
    await restoreFlags(page.request, flags);
  }

  await page.goto("/");
  await expect(page.locator(`header ${tel}`)).toHaveCount(0);
});

test("an SEO override from the console is on the page on the next request, in its language only", async ({
  page,
  baseURL,
}) => {
  await signInOwner(page, baseURL!);
  const title = "Политика конфиденциальности — E2E";
  let created: AdminSeoOverride | undefined;

  try {
    await page.goto("/admin/seo");
    await waitForShell(page);
    await expect(page.getByRole("heading", { level: 1, name: "SEO" })).toBeVisible();
    await page.getByRole("button", { name: "Yeni SEO dəyişikliyi" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Səhifə", { exact: true }).fill("/mexfilik-siyaseti/");
    await dialog.getByRole("tab", { name: /^RU/ }).first().click();
    await dialog.getByRole("textbox", { name: "Başlıq (Rusca)" }).fill(title);
    const description =
      "Как мы храним и используем данные, которые вы оставляете на сайте. ".repeat(3);
    await dialog.getByRole("tab", { name: /^RU/ }).nth(1).click();
    await dialog.getByRole("textbox", { name: "Təsvir (Rusca)" }).fill(description);
    // The preview and the length warning follow the typing.
    await expect(dialog.getByText(/Uzundur: axtarış nəticəsində 160 simvoldan/)).toBeVisible();
    await dialog.getByRole("tab", { name: /^RU/ }).nth(2).click();
    await expect(dialog.locator('[data-seo-preview="ru"]')).toContainText("/ru/mexfilik-siyaseti");
    await expect(dialog.locator('[data-seo-preview="ru"]')).toContainText(title);

    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/admin/seo-overrides") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Əlavə et" }).click();
    created = (await (await saved).json()) as AdminSeoOverride;
    await expect(page.getByText("SEO dəyişikliyi əlavə edildi")).toBeVisible();
    expect(created.path).toBe("/mexfilik-siyaseti");

    await page.goto("/ru/mexfilik-siyaseti");
    await expect(page).toHaveTitle(title);
    await page.goto("/mexfilik-siyaseti");
    await expect(page).not.toHaveTitle(title);
  } finally {
    if (created) {
      const response = await page.request.delete(`/api/v1/admin/seo-overrides/${created.id}`);
      expect(response.status()).toBe(204);
    }
  }

  await page.goto("/ru/mexfilik-siyaseti");
  await expect(page).not.toHaveTitle(title);
});
