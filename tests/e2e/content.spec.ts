import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { connect, databaseUrl } from "@/db/client";
import { galleryCategories, galleryItems } from "@/db/schema";
import { setOwner } from "@/lib/auth/owner";
import type { AdminConstructionUpdate, AdminNews } from "@/shared/content";
import type { AdminMedia, UploadTicket } from "@/shared/media";
import { paragraphs } from "@/shared/rich-text";

const email = "e2e-content@test.kalbajarcity.com";
const password = "an e2e passphrase that is long";
// beforeAll cannot read the test-scoped baseURL; playwright.config.ts loads E2E_PORT from .env.
const origin = `http://localhost:${process.env.E2E_PORT ?? 3011}`;

// Public content is published and removed again, so the file runs once, on
// desktop, in one worker.
test.skip(({ isMobile }) => isMobile, "the content does not depend on the viewport");
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  // Skipped tests still run beforeAll; two projects must not create the owner at once.
  if (testInfo.project.name !== "desktop") return;
  const { db, close } = connect(databaseUrl());
  try {
    await setOwner(db, { email, name: "E2E Content Owner", password });
  } finally {
    await close();
  }
});

async function signIn(request: APIRequestContext, baseURL: string) {
  const octet = Math.floor(Math.random() * 250) + 1;
  const response = await request.post("/api/v1/auth/sign-in/email", {
    headers: { origin: baseURL, "x-forwarded-for": `198.51.100.${octet}` },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

/** A small generated landscape, uploaded through the presigned flow. */
async function upload(request: APIRequestContext, n: number, caption: string): Promise<AdminMedia> {
  const jpeg = await sharp({
    create: {
      width: 1200,
      height: n % 2 ? 900 : 1500,
      channels: 3,
      background: { r: 90 + n * 30, g: 110, b: 100 },
    },
  })
    .jpeg()
    .toBuffer();
  const ticket = (await (
    await request.post("/api/v1/admin/media/uploads", {
      data: { filename: `e2e-${n}.jpg`, mimeType: "image/jpeg", size: jpeg.byteLength },
    })
  ).json()) as UploadTicket;
  const put = await request.fetch(ticket.url, {
    method: ticket.method,
    headers: ticket.headers,
    data: jpeg,
  });
  expect(put.status()).toBe(200);
  const created = await request.post("/api/v1/admin/media", {
    data: {
      key: ticket.key,
      source: "generated",
      alt: { az: `Sınaq şəkli ${n}` },
      caption: { az: caption },
    },
  });
  expect(created.status()).toBe(201);
  return (await created.json()) as AdminMedia;
}

test("a construction update published in the console shows on /tikinti and the home page", async ({
  page,
  request,
  baseURL,
}) => {
  await signIn(request, baseURL!);
  // A month after any real one, so it is the latest: the one the home page shows.
  const month = `2099-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}`;
  const title = `Sınaq yeniliyi ${randomUUID().slice(0, 6)}`;
  const created = await request.post("/api/v1/admin/construction-updates", {
    data: {
      month,
      title: { az: title, en: `Test update ${title.slice(-6)}` },
      body: { az: paragraphs("Karkas işləri davam edir.") },
      progressPercent: 87,
    },
  });
  expect(created.status()).toBe(201);
  const update = (await created.json()) as AdminConstructionUpdate;

  try {
    // Warm the cached pages, so a stale copy is what a missed revalidation would serve.
    await page.goto("/tikinti");
    await expect(page.getByText(title)).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByText(title)).toHaveCount(0);

    const published = await request.put(
      `/api/v1/admin/construction-updates/${update.id}/publication`,
      { data: {} },
    );
    expect(published.status()).toBe(200);

    await page.goto("/tikinti");
    const entry = page.getByRole("listitem").filter({ has: page.getByText(title) });
    await expect(entry.getByRole("heading", { level: 3 })).toHaveText(title);
    await expect(entry).toContainText("Karkas işləri davam edir.");
    const overall = page.getByRole("progressbar");
    await expect(overall).toHaveAttribute("aria-valuenow", "87");
    await expect(overall).toHaveAccessibleName("87% tamamlanıb");

    await page.goto("/");
    const teaser = page.locator('section[aria-labelledby="tikinti"]');
    await expect(teaser).toContainText(title);
    await expect(teaser).toContainText("87% tamamlanıb");

    await page.goto("/en/tikinti");
    await expect(page.getByRole("heading", { level: 3, name: /^Test update/ })).toBeVisible();
  } finally {
    const deleted = await request.delete(`/api/v1/admin/construction-updates/${update.id}`);
    expect(deleted.status()).toBe(204);
  }
  await page.goto("/tikinti");
  await expect(page.getByText(title)).toHaveCount(0);
});

test("an article is public only once it is published", async ({ page, request, baseURL }) => {
  await signIn(request, baseURL!);
  const slug = `e2e-xeber-${randomUUID().slice(0, 6)}`;
  const created = await request.post("/api/v1/admin/news", {
    data: {
      slug,
      title: { az: "Sınaq xəbəri", en: "Test article" },
      body: {
        az: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Birinci abzas." }] },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "zərərli link",
                  marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
                },
              ],
            },
            { type: "codeBlock", content: [{ type: "text", text: "gizli" }] },
          ],
        },
      },
    },
  });
  expect(created.status()).toBe(201);
  const article = (await created.json()) as AdminNews;

  try {
    expect((await page.goto(`/xeberler/${slug}`))?.status()).toBe(404);
    const published = await request.put(`/api/v1/admin/news/${article.id}/publication`, {
      data: {},
    });
    expect(published.status()).toBe(200);

    await page.goto("/xeberler");
    await page.getByRole("link", { name: "Sınaq xəbəri" }).click();
    await expect(page).toHaveURL(new RegExp(`/xeberler/${slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sınaq xəbəri");
    const body = page.getByRole("article", { name: "Sınaq xəbəri" });
    await expect(body.getByText("Birinci abzas.")).toHaveCount(1);
    // The unsafe link is text, and the unknown node is gone.
    await expect(body.getByText("zərərli link")).toBeVisible();
    await expect(page.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(page.getByText("gizli")).toHaveCount(0);

    // The slug is Azerbaijani in every locale; the language switcher keeps it.
    await page.goto(`/en/xeberler/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test article");
  } finally {
    const deleted = await request.delete(`/api/v1/admin/news/${article.id}`);
    expect(deleted.status()).toBe(204);
  }
  expect((await page.goto(`/xeberler/${slug}`))?.status()).toBe(404);
});

test.describe("the gallery lightbox", () => {
  const slug = `e2e-${randomUUID().slice(0, 6)}`;
  const files: AdminMedia[] = [];

  test.beforeAll(async ({ playwright }, testInfo) => {
    if (testInfo.project.name !== "desktop") return;
    const request = await playwright.request.newContext({ baseURL: origin });
    await signIn(request, origin);
    for (const [n, caption] of ["Şimal fasadı", "Həyət", "Lobbi"].entries()) {
      files.push(await upload(request, n, caption));
    }
    const { db, close } = connect(databaseUrl());
    try {
      const [category] = await db
        .insert(galleryCategories)
        .values({ slug, name: { az: "E2E" }, sortOrder: 999 })
        .returning();
      await db
        .insert(galleryItems)
        .values(
          files.map((file, i) => ({ categoryId: category!.id, mediaId: file.id, sortOrder: i })),
        );
    } finally {
      await close();
    }
    // Gallery writes arrive with #25; a console edit of a file revalidates the gallery meanwhile.
    expect(
      (
        await request.patch(`/api/v1/admin/media/${files[0]!.id}`, { data: { focusY: 0.5 } })
      ).status(),
    ).toBe(200);
    await request.dispose();
  });

  test.afterAll(async ({ playwright }, testInfo) => {
    if (testInfo.project.name !== "desktop") return;
    const { db, close } = connect(databaseUrl());
    try {
      await db.delete(galleryCategories).where(eq(galleryCategories.slug, slug));
    } finally {
      await close();
    }
    const request = await playwright.request.newContext({ baseURL: origin });
    await signIn(request, origin);
    for (const file of files) {
      expect((await request.delete(`/api/v1/admin/media/${file.id}`)).status()).toBe(204);
    }
    await request.dispose();
  });

  const live = (page: Page) => page.getByRole("dialog").locator('[aria-live="polite"]');

  test("works with the keyboard alone, announces the position and returns focus", async ({
    page,
  }) => {
    await page.goto(`/qalereya?kateqoriya=${slug}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    const thumbnails = page.getByRole("button", { name: /^Şəkli böyüt: Sınaq şəkli/ });
    await expect(thumbnails).toHaveCount(3);
    await expect(page.getByText("İllüstrativ").first()).toBeVisible();

    const second = thumbnails.nth(1);
    await second.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Şəkil baxışı" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Bağla" })).toBeFocused();
    await expect(live(page)).toHaveText("Şəkil 2, cəmi 3. Həyət");
    await expect(dialog.locator("figcaption")).toContainText("Həyət");

    await page.keyboard.press("ArrowRight");
    await expect(live(page)).toHaveText("Şəkil 3, cəmi 3. Lobbi");
    await page.keyboard.press("ArrowRight");
    await expect(live(page)).toHaveText("Şəkil 1, cəmi 3. Şimal fasadı");
    await page.keyboard.press("End");
    await expect(live(page)).toHaveText("Şəkil 3, cəmi 3. Lobbi");
    await page.keyboard.press("ArrowLeft");
    await expect(live(page)).toHaveText("Şəkil 2, cəmi 3. Həyət");
    await expect(dialog.locator("img")).toHaveAttribute("alt", "Sınaq şəkli 1");

    // Tab stays inside the dialog: close, previous, next, and round again.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await dialog.getByRole("button", { name: "Növbəti şəkil" }).focus();
    await page.keyboard.press("Enter");
    await expect(live(page)).toHaveText("Şəkil 3, cəmi 3. Lobbi");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(second).toBeFocused();
  });

  test("moves between images with a swipe", async ({ page }) => {
    await page.goto(`/qalereya?kateqoriya=${slug}`);
    await page.getByRole("button", { name: "Şəkli böyüt: Sınaq şəkli 0" }).click();
    await expect(live(page)).toHaveText("Şəkil 1, cəmi 3. Şimal fasadı");
    const stage = page.getByRole("dialog").locator("[data-lightbox-slide]");
    const box = (await stage.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.7, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, y, { steps: 5 });
    await page.mouse.up();
    await expect(live(page)).toHaveText("Şəkil 2, cəmi 3. Həyət");
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, y, { steps: 5 });
    await page.mouse.up();
    await expect(live(page)).toHaveText("Şəkil 1, cəmi 3. Şimal fasadı");
  });
});

test("pages show their empty state or content without horizontal scroll at 320 px", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, baseURL });
  try {
    const page = await context.newPage();
    for (const path of ["/tikinti", "/qalereya", "/xeberler", "/ru/tikinti", "/ru/xeberler"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
    expect((await page.goto("/xeberler?sehife=999"))?.status()).toBe(404);
    expect((await page.goto("/xeberler/yoxdur"))?.status()).toBe(404);
  } finally {
    await context.close();
  }
});
