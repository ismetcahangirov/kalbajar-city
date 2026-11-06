import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import type { AdminConstructionUpdate } from "@/shared/content";
import type { AdminMedia } from "@/shared/media";
import { paragraphs } from "@/shared/rich-text";

import { playableH264Mp4 } from "../fixtures/h264";
import { ensureAccount, signIn, uploadFile, uploadImage, waitForShell } from "./console";

/** A month long past, of this run: one update per month, and never the latest the home shows. */
function month(): string {
  const year = 1900 + Math.floor(Math.random() * 100);
  return `${year}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}`;
}

const base = "/admin/xeberler/tikinti";

async function signInEditor(page: Page, key: string, baseURL: string) {
  const email = `e2e-construction-${key}@test.kalbajarcity.com`;
  await ensureAccount("editor", email, "E2E Construction Editor");
  await signIn(page, email, baseURL);
}

/** Removes files a test made; a video's poster is unlinked first, as the API requires. */
async function removeFiles(page: Page, files: AdminMedia[]) {
  for (const file of files) {
    if (file.kind === "video") {
      await page.request.patch(`/api/v1/admin/media/${file.id}`, {
        data: { posterMediaId: null },
      });
    }
  }
  for (const file of files) await page.request.delete(`/api/v1/admin/media/${file.id}`);
}

test.describe("publishing", () => {
  test.skip(({ isMobile }) => isMobile, "publishing does not depend on the viewport");

  test("an editor writes an update with ordered photos and a video, and /tikinti follows", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    await signInEditor(page, "publish", baseURL!);
    const run = randomUUID().slice(0, 8);
    const alts = { a: `Foto A ${run}`, b: `Foto B ${run}` };
    const names = {
      a: `e2e-tikinti-a-${run}.jpg`,
      b: `e2e-tikinti-b-${run}.jpg`,
      v: `e2e-tikinti-v-${run}.mp4`,
      p: `e2e-tikinti-p-${run}.jpg`,
    };
    const a = await uploadImage(page.request, names.a, alts.a);
    const b = await uploadImage(page.request, names.b, alts.b);
    const poster = await uploadImage(page.request, names.p, `Poster ${run}`);
    const video = await uploadFile(page.request, {
      name: names.v,
      mimeType: "video/mp4",
      bytes: Buffer.from(playableH264Mp4()),
    });
    const titles = { az: `Sınaq ayı ${run}`, en: `Test month ${run}`, ru: `Тестовый месяц ${run}` };
    const shownOrder = async () =>
      page
        .getByRole("listitem")
        .filter({ hasText: titles.az })
        .getByRole("img")
        .evaluateAll((images) => images.map((image) => image.getAttribute("alt")));
    let id: string | undefined;
    let capturedPoster: string | undefined;

    try {
      await page.goto("/admin/xeberler");
      await waitForShell(page);
      await page.getByRole("link", { name: "Tikinti gedişatı" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tikinti gedişatı");
      await page.getByRole("link", { name: "Yeni yenilik" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeni yenilik");

      await page.getByLabel("Ay", { exact: true }).fill(month());
      await page.getByLabel("Tamamlanıb (%)").fill("64");
      const title = page.getByRole("group", { name: "Başlıq", exact: true });
      for (const [locale, name] of [
        ["az", "Azərbaycanca"],
        ["en", "İngiliscə"],
        ["ru", "Rusca"],
      ] as const) {
        await title.getByRole("tab", { name: new RegExp(`^${locale.toUpperCase()}`) }).click();
        await title.getByLabel(`Başlıq (${name})`).fill(titles[locale]);
      }
      const body = page.getByRole("textbox", { name: "Mətn (Azərbaycanca)" });
      await body.click();
      await page.keyboard.type("Karkas işləri davam edir.");

      // Three files from the library, each opened from the same button.
      const field = page.getByRole("group", { name: "Foto və video" });
      for (const name of [names.a, names.b, names.v]) {
        await field.getByRole("button", { name: "Foto və ya video əlavə et" }).click();
        const picker = page.getByRole("dialog", { name: "Foto və ya video əlavə et" });
        await picker.getByRole("searchbox").fill(name);
        await picker.getByRole("button", { name: `Seç: ${name}` }).click();
        await expect(picker).toBeHidden();
      }
      const rows = field.getByRole("list", { name: "Foto və videoların sırası" }).locator("> li");
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText(names.a);

      // A file already linked cannot be chosen twice.
      await field.getByRole("button", { name: "Foto və ya video əlavə et" }).click();
      const again = page.getByRole("dialog", { name: "Foto və ya video əlavə et" });
      await again.getByRole("searchbox").fill(names.a);
      await expect(again.getByRole("button", { name: `Seç: ${names.a}` })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(again).toBeHidden();

      await page.getByRole("button", { name: "Qaralama kimi yarat" }).click();
      await page.waitForURL(new RegExp(`${base}/[0-9a-f-]{36}$`));
      id = page.url().split("/").pop();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Yeniliyi redaktə et");
      const read = async () =>
        (await (
          await page.request.get(`/api/v1/admin/construction-updates/${id}`)
        ).json()) as AdminConstructionUpdate;
      expect(await read()).toMatchObject({
        state: "draft",
        progressPercent: 64,
        mediaIds: [a.id, b.id, video.id],
      });

      // Moving a row is an unsaved edit: the panel waits, and leaving asks.
      const saved = page.getByRole("list", { name: "Foto və videoların sırası" }).locator("> li");
      const publication = page.getByRole("region", { name: "Dərc" });
      const publishNow = publication.getByRole("button", { name: "İndi dərc et" });
      await expect(publishNow).toBeEnabled();
      await page.getByRole("button", { name: `Aşağı apar: ${names.a}` }).click();
      await expect(saved.nth(0)).toContainText(names.b);
      await expect(publishNow).toBeDisabled();
      await page.getByRole("button", { name: "Yadda saxla", exact: true }).click();
      await expect(page.getByText("Dəyişikliklər yadda saxlanıldı.")).toBeVisible();
      await expect(publishNow).toBeEnabled();
      expect((await read()).mediaIds).toEqual([b.id, a.id, video.id]);

      // The order survives a reload.
      await page.reload();
      await waitForShell(page);
      await expect(saved.nth(0)).toContainText(names.b);
      await expect(saved.nth(1)).toContainText(names.a);

      // The video has no poster yet: it is set here, on the file.
      await expect(saved.nth(2)).toContainText("Posteri yoxdur.");
      await page.getByRole("button", { name: `Poster: ${names.v}` }).click();
      const dialog = page.getByRole("dialog", { name: "Video və poster kadrı" });
      await dialog.getByRole("button", { name: "Kitabxanadan seç" }).click();
      const posterPicker = page.getByRole("dialog", { name: "Kitabxanadan seç" });
      await posterPicker.getByRole("searchbox").fill(names.p);
      await posterPicker.getByRole("button", { name: `Seç: ${names.p}` }).click();
      await expect(dialog.locator(`[data-poster="${poster.id}"]`)).toBeVisible();
      // Or the frame on screen, captured in the browser, as in the library.
      await expect
        .poll(() =>
          dialog.locator("video").evaluate((element) => (element as HTMLVideoElement).readyState),
        )
        .toBeGreaterThanOrEqual(2);
      await dialog.getByRole("button", { name: "Bu kadrı poster et" }).click();
      await expect(dialog.locator(`[data-poster="${poster.id}"]`)).toHaveCount(0);
      const withFrame = (await (
        await page.request.get(`/api/v1/admin/media/${video.id}`)
      ).json()) as AdminMedia;
      expect(withFrame.poster?.id).toBeTruthy();
      expect(withFrame.poster?.id).not.toBe(poster.id);
      capturedPoster = withFrame.poster?.id;
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(saved.nth(2)).not.toContainText("Posteri yoxdur.");

      await publishNow.click();
      await expect(publication).toContainText("Dərc edilib");
      await expect(page.getByRole("link", { name: "Saytda bax" })).toHaveAttribute(
        "href",
        "/tikinti",
      );

      for (const [prefix, locale] of [
        ["", "az"],
        ["/en", "en"],
        ["/ru", "ru"],
      ] as const) {
        await page.goto(`${prefix}/tikinti`);
        await expect(page.getByRole("heading", { level: 3, name: titles[locale] })).toBeVisible();
      }
      await page.goto("/tikinti");
      await expect(page.getByText("Karkas işləri davam edir.")).toBeVisible();
      expect(await shownOrder()).toEqual([alts.b, alts.a]);
      const entry = page.getByRole("listitem").filter({ hasText: titles.az });
      await expect(entry.locator("video")).toHaveAttribute("poster", /.+/);

      // Reordering a published update reaches the cached page.
      await page.goto(`${base}/${id}`);
      await waitForShell(page);
      await page.getByRole("button", { name: `Yuxarı apar: ${names.a}` }).click();
      await page.getByRole("button", { name: "Yadda saxla", exact: true }).click();
      await expect(page.getByText("Dəyişikliklər yadda saxlanıldı.")).toBeVisible();
      await page.goto("/tikinti");
      await expect(entry).toBeVisible();
      expect(await shownOrder()).toEqual([alts.a, alts.b]);

      // Removing a file takes it off the update, not out of the library.
      await page.goto(`${base}/${id}`);
      await waitForShell(page);
      await page.getByRole("button", { name: `Sil: ${names.a}` }).click();
      await expect(field.getByRole("button", { name: "Foto və ya video əlavə et" })).toBeFocused();
      await page.getByRole("button", { name: "Yadda saxla", exact: true }).click();
      await expect(page.getByText("Dəyişikliklər yadda saxlanıldı.")).toBeVisible();
      expect((await read()).mediaIds).toEqual([b.id, video.id]);
      expect((await page.request.get(`/api/v1/admin/media/${a.id}`)).status()).toBe(200);

      // Deleting from the form: it asks, goes back to the list, and the page follows.
      await page.getByRole("button", { name: "Yeniliyi sil" }).click();
      await page
        .getByRole("alertdialog", { name: "Bu yenilik silinsin?" })
        .getByRole("button", { name: "Yeniliyi sil" })
        .click();
      await page.waitForURL(new RegExp(`${base}$`));
      id = undefined;
      await page.goto("/tikinti");
      await expect(page.getByText(titles.az)).toHaveCount(0);
    } finally {
      if (id) await page.request.delete(`/api/v1/admin/construction-updates/${id}`);
      await removeFiles(page, [video, a, b, poster]);
      if (capturedPoster) await page.request.delete(`/api/v1/admin/media/${capturedPoster}`);
    }
  });

  test("an update is scheduled and cancelled from its panel, and stays off the site", async ({
    page,
    baseURL,
  }) => {
    await signInEditor(page, "schedule", baseURL!);
    const title = `Planlı ay ${randomUUID().slice(0, 8)}`;
    const created = await page.request.post("/api/v1/admin/construction-updates", {
      data: { month: month(), title: { az: title }, progressPercent: 10 },
    });
    expect(created.status()).toBe(201);
    const update = (await created.json()) as AdminConstructionUpdate;

    try {
      await page.goto(`${base}/${update.id}`);
      await waitForShell(page);
      const publication = page.getByRole("region", { name: "Dərc" });
      await expect(publication).toContainText("Qaralama");
      // A day ahead, so another test's cron run never publishes it. Baku is UTC+4.
      const at = new Date(Date.now() + 86_400_000 + 4 * 3_600_000).toISOString().slice(0, 16);
      await publication.getByLabel("Dərc vaxtı (Bakı vaxtı)").fill(at);
      await publication.getByRole("button", { name: "Planlaşdır" }).click();
      await expect(publication).toContainText("Planlaşdırılıb");

      await page.goto(base);
      await waitForShell(page);
      await page.getByRole("button", { name: "Planlaşdırılıb" }).click();
      const row = page.getByRole("listitem").filter({ hasText: title });
      await expect(row).toContainText("Planlaşdırılıb");
      await expect(row).toContainText("%10");
      await expect(row).toContainText("tarixində dərc olunacaq");

      await page.goto("/tikinti");
      await expect(page.getByText(title)).toHaveCount(0);

      await page.goto(`${base}/${update.id}`);
      await waitForShell(page);
      await publication.getByRole("button", { name: "Planı ləğv et" }).click();
      await expect(page.getByText("Plan ləğv edildi.")).toBeVisible();
      await expect(publication).toContainText("Qaralama");
    } finally {
      await page.request.delete(`/api/v1/admin/construction-updates/${update.id}`);
    }
  });

  test("a month that is taken and values out of range are refused on their fields", async ({
    page,
    baseURL,
  }) => {
    await signInEditor(page, "invalid", baseURL!);
    const taken = month();
    const created = await page.request.post("/api/v1/admin/construction-updates", {
      data: {
        month: taken,
        title: { az: `Tutulmuş ay ${randomUUID().slice(0, 8)}` },
        body: { az: paragraphs("Mətn.") },
        progressPercent: 1,
      },
    });
    expect(created.status()).toBe(201);
    const update = (await created.json()) as AdminConstructionUpdate;

    try {
      await page.goto(`${base}/yeni`);
      await waitForShell(page);
      const create = page.getByRole("button", { name: "Qaralama kimi yarat" });
      const monthField = page.getByLabel("Ay", { exact: true });
      const progress = page.getByLabel("Tamamlanıb (%)");

      await create.click();
      await expect(monthField).toHaveAttribute("aria-invalid", "true");
      await expect(progress).toHaveAttribute("aria-invalid", "true");

      await monthField.fill(taken);
      await progress.fill("101");
      await page
        .getByRole("group", { name: "Başlıq", exact: true })
        .getByLabel("Başlıq (Azərbaycanca)")
        .fill("Təkrar ay");
      await create.click();
      await expect(progress).toHaveAttribute("aria-invalid", "true");
      await expect(page).toHaveURL(new RegExp(`${base}/yeni$`));

      await progress.fill("50");
      await create.click();
      await expect(page.getByText("Bu ay üçün artıq yenilik var.")).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${base}/yeni$`));
    } finally {
      await page.request.delete(`/api/v1/admin/construction-updates/${update.id}`);
    }
  });
});

test("the console's construction screens work on a phone, reordering included", async ({
  page,
  baseURL,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const key = `phone-${info.project.name}`;
  await signInEditor(page, key, baseURL!);
  const run = randomUUID().slice(0, 8);
  const first = await uploadImage(page.request, `e2e-tel-a-${run}.jpg`, `Telefon A ${run}`);
  const second = await uploadImage(page.request, `e2e-tel-b-${run}.jpg`, `Telefon B ${run}`);
  const created = await page.request.post("/api/v1/admin/construction-updates", {
    data: {
      month: month(),
      title: { az: `Telefon ayı ${run}` },
      progressPercent: 30,
      mediaIds: [first.id, second.id],
    },
  });
  expect(created.status()).toBe(201);
  const update = (await created.json()) as AdminConstructionUpdate;
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

  try {
    await page.goto(base);
    await waitForShell(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tikinti gedişatı");
    await expect(page.getByRole("button", { name: "Qaralama", exact: true })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);

    await page.goto(`${base}/${update.id}`);
    await waitForShell(page);
    const rows = page.getByRole("list", { name: "Foto və videoların sırası" }).locator("> li");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(first.originalName!);
    expect(await overflow()).toBeLessThanOrEqual(0);

    // By keyboard: pick up with Space on the handle, move, drop.
    const handle = page.getByRole("button", {
      name: `Sürüşdürüb sırasını dəyiş: ${first.originalName}`,
    });
    await handle.focus();
    await page.keyboard.press("Space");
    // dnd-kit's keyboard sensor listens for arrows from a `setTimeout` queued at
    // the pick-up; an arrow sent before it runs is lost (see faq-gallery.spec.ts).
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)));
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("status").filter({ hasText: `${first.originalName}: indi 2-ci yerdədir` }),
    ).toHaveCount(1);
    await page.keyboard.press("Space");
    await expect(rows.nth(0)).toContainText(second.originalName!);

    await page.getByRole("button", { name: "Yadda saxla", exact: true }).click();
    await expect(page.getByText("Dəyişikliklər yadda saxlanıldı.")).toBeVisible();
    const saved = (await (
      await page.request.get(`/api/v1/admin/construction-updates/${update.id}`)
    ).json()) as AdminConstructionUpdate;
    expect(saved.mediaIds).toEqual([second.id, first.id]);
  } finally {
    await page.request.delete(`/api/v1/admin/construction-updates/${update.id}`);
    await removeFiles(page, [first, second]);
  }
});
