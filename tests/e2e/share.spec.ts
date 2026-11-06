import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { paragraphs } from "@/shared/rich-text";

import { ensureAccount, signIn } from "./console";

test.skip(({ isMobile }) => isMobile, "sharing does not depend on the viewport");

/** A browser with no share sheet whose clipboard records what it is given. */
async function withClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as unknown as { copied: string }).copied = text;
          return Promise.resolve();
        },
      },
    });
  });
}

const copied = (page: Page) =>
  page.evaluate(() => (window as unknown as { copied?: string }).copied);

test("an apartment shares with a round button, says so, and can still be printed", async ({
  page,
}) => {
  await withClipboard(page);
  await page.goto("/menziller");
  await page
    .locator('a[href*="/menziller/"]')
    .first()
    .evaluate((link) => (link as HTMLAnchorElement).click());
  await page.waitForURL(/\/menziller\/[^/?]+$/);
  const address = page.url();

  await page.getByRole("button", { name: "Paylaş" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link kopyalandı" })).toHaveCount(1);
  expect(await copied(page)).toBe(address);
  await expect(page.getByRole("button", { name: "Çap et" })).toBeVisible();
});

test("an article shares with a labelled button and writes the result beside it", async ({
  page,
  baseURL,
}) => {
  const email = "e2e-share@test.kalbajarcity.com";
  await ensureAccount("editor", email, "E2E Share Editor");
  await signIn(page, email, baseURL!);
  const created = await page.request.post("/api/v1/admin/news", {
    data: {
      title: { az: `Paylaşım ${randomUUID().slice(0, 8)}` },
      body: { az: paragraphs("Mətn.") },
    },
  });
  expect(created.status()).toBe(201);
  const article = (await created.json()) as { id: string; slug: string };

  try {
    await page.request.put(`/api/v1/admin/news/${article.id}/publication`, { data: {} });
    await withClipboard(page);
    await page.goto(`/xeberler/${article.slug}#mətn`);
    await page.getByRole("button", { name: "Paylaş" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Link kopyalandı" })).toBeVisible();
    // The address without the fragment the reader happened to be at.
    expect(await copied(page)).toBe(new URL(`/xeberler/${article.slug}`, baseURL).href);
  } finally {
    await page.request.delete(`/api/v1/admin/news/${article.id}`);
  }
});
