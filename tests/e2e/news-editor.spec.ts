import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";
import sharp from "sharp";

import type { AdminNews } from "@/shared/content";
import type { AdminMedia, UploadTicket } from "@/shared/media";
import { paragraphs } from "@/shared/rich-text";

import { ensureAccount, signIn, waitForShell } from "./console";

/** CRON_SECRET of the E2E server (playwright.config.ts). */
const cronSecret = "e2e-cron-secret";

// Articles are published and removed again; the viewport does not matter.
test.skip(({ isMobile }) => isMobile, "publishing does not depend on the viewport");

/** A small generated image with Azerbaijani alt text, uploaded through the presigned flow. */
async function upload(request: APIRequestContext, name: string): Promise<AdminMedia> {
  const jpeg = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 120, g: 140, b: 110 } },
  })
    .jpeg()
    .toBuffer();
  const ticket = (await (
    await request.post("/api/v1/admin/media/uploads", {
      data: { filename: name, mimeType: "image/jpeg", size: jpeg.byteLength },
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
      originalName: name,
      source: "generated",
      alt: { az: "Sınaq üz şəkli" },
    },
  });
  expect(created.status()).toBe(201);
  return (await created.json()) as AdminMedia;
}

test("an editor writes an article in three languages with a cover and publishes it", async ({
  page,
  baseURL,
}) => {
  const email = "e2e-news@test.kalbajarcity.com";
  await ensureAccount("editor", email, "E2E News Editor");
  await signIn(page, email, baseURL!);
  const run = randomUUID().slice(0, 6);
  const cover = await upload(page.request, `e2e-news-cover-${run}.jpg`);
  const titles = {
    az: `Sınaq xəbəri ${run}`,
    en: `Test article ${run}`,
    ru: `Тестовая новость ${run}`,
  };
  const texts = {
    az: "Tikinti planlaşdırıldığı kimi gedir.",
    en: "Construction is on schedule.",
    ru: "Строительство идёт по плану.",
  };
  let id: string | undefined;

  try {
    await page.goto("/admin/xeberler");
    await waitForShell(page);
    await page.getByRole("link", { name: "Yeni xəbər" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeni xəbər");

    const title = page.getByRole("group", { name: "Başlıq", exact: true });
    const body = page.getByRole("group", { name: "Mətn", exact: true });
    for (const [locale, name] of [
      ["az", "Azərbaycanca"],
      ["en", "İngiliscə"],
      ["ru", "Rusca"],
    ] as const) {
      await title.getByRole("tab", { name: new RegExp(`^${locale.toUpperCase()}`) }).click();
      await title.getByLabel(`Başlıq (${name})`).fill(titles[locale]);

      await body.getByRole("tab", { name: new RegExp(`^${locale.toUpperCase()}`) }).click();
      const editor = body.getByRole("textbox", { name: `Mətn (${name})` });
      await editor.click();
      // A heading from the toolbar, then a paragraph.
      await body
        .getByRole("toolbar", { name: `Formatlama: Mətn (${name})` })
        .getByRole("button", { name: "Başlıq", exact: true })
        .click();
      // The toolbar hands focus back to the text on the next frame.
      await expect(editor).toBeFocused();
      await page.keyboard.type(`${titles[locale]}: gedişat`);
      await page.keyboard.press("Enter");
      await page.keyboard.type(texts[locale]);
      await expect(editor.locator("h2")).toHaveText(`${titles[locale]}: gedişat`);
    }
    // Every translation is there: no tab says one is missing.
    await expect(body.getByLabel("tərcümə yoxdur")).toHaveCount(0);

    const coverField = page.getByRole("group", { name: "Üz şəkli" });
    await coverField.getByRole("button", { name: "Şəkil seç" }).click();
    const picker = page.getByRole("dialog", { name: "Üz şəkli" });
    await picker.getByRole("searchbox").fill(`e2e-news-cover-${run}`);
    await picker.getByRole("button", { name: `Seç: e2e-news-cover-${run}.jpg` }).click();
    await expect(picker).toBeHidden();
    await expect(coverField).toContainText(`e2e-news-cover-${run}.jpg`);

    await page.getByRole("button", { name: "Qaralama kimi yarat" }).click();
    await page.waitForURL(/\/admin\/xeberler\/[0-9a-f-]{36}$/);
    id = page.url().split("/").pop();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xəbəri redaktə et");

    const publication = page.getByRole("region", { name: "Dərc" });
    await expect(publication).toContainText("Qaralama");
    await publication.getByRole("button", { name: "İndi dərc et" }).click();
    await expect(publication).toContainText("Dərc edilib");

    const saved = (await (await page.request.get(`/api/v1/admin/news/${id}`)).json()) as AdminNews;
    expect(saved).toMatchObject({ state: "published", coverMediaId: cover.id });

    for (const [prefix, locale] of [
      ["", "az"],
      ["/en", "en"],
      ["/ru", "ru"],
    ] as const) {
      await page.goto(`${prefix}/xeberler/${saved.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(titles[locale]);
      await expect(
        page.getByRole("heading", { level: 2, name: `${titles[locale]}: gedişat` }),
      ).toBeVisible();
      await expect(page.getByText(texts[locale])).toBeVisible();
      await expect(page.getByRole("img", { name: "Sınaq üz şəkli" }).first()).toBeVisible();
    }
    await page.goto("/xeberler");
    await expect(page.getByText(titles.az)).toBeVisible();
  } finally {
    if (id) await page.request.delete(`/api/v1/admin/news/${id}`);
  }
});

test("a scheduled article appears on the cached list once the cron trigger runs", async ({
  page,
  baseURL,
}) => {
  const email = "e2e-news-schedule@test.kalbajarcity.com";
  await ensureAccount("editor", email, "E2E News Editor");
  await signIn(page, email, baseURL!);
  const title = `Planlı xəbər ${randomUUID().slice(0, 6)}`;
  const created = await page.request.post("/api/v1/admin/news", {
    data: { title: { az: title }, body: { az: paragraphs("Planlı mətn.") } },
  });
  expect(created.status()).toBe(201);
  const article = (await created.json()) as AdminNews;

  try {
    // Warm the cached list, so a missed revalidation would serve it stale.
    await page.goto("/xeberler");
    await expect(page.getByText(title)).toHaveCount(0);

    const at = new Date(Date.now() + 2_000).toISOString();
    const scheduled = await page.request.put(`/api/v1/admin/news/${article.id}/publication`, {
      data: { publishedAt: at },
    });
    expect(await scheduled.json()).toMatchObject({ state: "scheduled" });

    const trigger = (secret: string) =>
      page.request.post("/api/v1/internal/scheduled-publications", {
        headers: { authorization: `Bearer ${secret}` },
      });
    expect((await trigger("wrong")).status()).toBe(401);
    await expect
      .poll(async () => ((await (await trigger(cronSecret)).json()) as { news: string[] }).news, {
        timeout: 10_000,
      })
      .toContain(article.id);

    await page.goto("/xeberler");
    await expect(page.getByText(title)).toBeVisible();
    await page.goto(`/xeberler/${article.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  } finally {
    await page.request.delete(`/api/v1/admin/news/${article.id}`);
  }
});

test("edits made after a save are unsaved: publishing waits and leaving asks", async ({
  page,
  baseURL,
}) => {
  const email = "e2e-news-dirty@test.kalbajarcity.com";
  await ensureAccount("editor", email, "E2E News Editor");
  await signIn(page, email, baseURL!);
  const title = `Redaktə ${randomUUID().slice(0, 6)}`;
  const created = await page.request.post("/api/v1/admin/news", {
    data: { title: { az: title }, body: { az: paragraphs("Mətn.") } },
  });
  expect(created.status()).toBe(201);
  const article = (await created.json()) as AdminNews;

  try {
    await page.goto(`/admin/xeberler/${article.id}`);
    await waitForShell(page);
    const field = page
      .getByRole("group", { name: "Başlıq", exact: true })
      .getByLabel("Başlıq (Azərbaycanca)");
    const publication = page.getByRole("region", { name: "Dərc" });
    const publishNow = publication.getByRole("button", { name: "İndi dərc et" });
    const save = page.getByRole("button", { name: "Yadda saxla", exact: true });
    await expect(publishNow).toBeEnabled();

    // The first save: the form matches what is stored again.
    await field.fill(`${title} 1`);
    await expect(publishNow).toBeDisabled();
    await save.click();
    await expect(page.getByText("Dəyişikliklər yadda saxlanıldı.")).toBeVisible();
    await expect(publishNow).toBeEnabled();

    // Editing again after that save is unsaved work too.
    await field.fill(`${title} 2`);
    await expect(publishNow).toBeDisabled();
    await expect(publication).toContainText("Əvvəlcə dəyişiklikləri yadda saxlayın.");
    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: "Xəbərlər", exact: true })
      .click();
    const leave = page.getByRole("alertdialog", { name: "Dəyişikliklər yadda saxlanmayıb" });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Səhifədə qal" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/xeberler/${article.id}$`));

    // A save that fails with no field to blame keeps the edits unsaved.
    await page.route(`**/api/v1/admin/news/${article.id}`, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 409,
            json: { error: { code: "CONFLICT", message: "Conflict." } },
          })
        : route.continue(),
    );
    await save.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "artıq istifadə olunur" }),
    ).toBeVisible();
    await expect(publishNow).toBeDisabled();
    await page.unroute(`**/api/v1/admin/news/${article.id}`);

    await save.click();
    await expect(publishNow).toBeEnabled();
    const saved = (await (
      await page.request.get(`/api/v1/admin/news/${article.id}`)
    ).json()) as AdminNews;
    expect(saved.title.az).toBe(`${title} 2`);
  } finally {
    await page.request.delete(`/api/v1/admin/news/${article.id}`);
  }
});

test("a scheduled article whose time has long passed shows as overdue", async ({
  page,
  baseURL,
}) => {
  const email = "e2e-news-overdue@test.kalbajarcity.com";
  await ensureAccount("editor", email, "E2E News Editor");
  await signIn(page, email, baseURL!);
  const title = `Gecikən xəbər ${randomUUID().slice(0, 6)}`;
  const created = await page.request.post("/api/v1/admin/news", {
    data: { title: { az: title }, body: { az: paragraphs("Planlı mətn.") } },
  });
  expect(created.status()).toBe(201);
  const article = (await created.json()) as AdminNews;

  try {
    // A day ahead, so another test's cron run never publishes it; the
    // browser's clock is then moved past it, as if no cron had run.
    const at = Date.now() + 86_400_000;
    const scheduled = await page.request.put(`/api/v1/admin/news/${article.id}/publication`, {
      data: { publishedAt: new Date(at).toISOString() },
    });
    expect(await scheduled.json()).toMatchObject({ state: "scheduled" });
    await page.clock.setFixedTime(at + 3_600_000);

    await page.goto("/admin/xeberler");
    await waitForShell(page);
    await page.getByRole("button", { name: "Planlaşdırılıb" }).click();
    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row).toContainText("Gecikir");
    await expect(row).toContainText("dərc olunmalı idi, hələ dərc olunmayıb");

    await row.getByRole("link", { name: title }).click();
    const publication = page.getByRole("region", { name: "Dərc" });
    await expect(publication).toContainText("Gecikir");
    await expect(publication).toContainText("planlaşdırılmış dərc işləmir");

    await publication.getByRole("button", { name: "Planı ləğv et" }).click();
    await expect(page.getByText("Plan ləğv edildi.")).toBeVisible();
    await expect(publication).toContainText("Qaralama");
  } finally {
    await page.request.delete(`/api/v1/admin/news/${article.id}`);
  }
});
