import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { connect, databaseUrl } from "@/db/client";
import { news } from "@/db/schema";
import { analyticsOrigins } from "@/lib/security/csp";
import type { AdminMedia, AdminMediaDetail, UploadTicket } from "@/shared/media";
import { paragraphs } from "@/shared/rich-text";

import { playableH264Mp4 } from "../fixtures/h264";
import { ensureAccount, signIn, waitForShell } from "./console";

/**
 * An editor of this test's own, signed in on the page: setting an account up
 * signs its other sessions out, so tests running at once never share one.
 */
async function signInEditor(page: Page, key: string, baseURL: string) {
  const email = `e2e-media-library-${key}@test.kalbajarcity.com`;
  await ensureAccount("editor", email, "E2E Media Editor");
  await signIn(page, email, baseURL);
}

/** A phone is 390 px wide in these tests, as the issue asks. */
async function sizeFor(page: Page, isMobile: boolean) {
  if (isMobile) await page.setViewportSize({ width: 390, height: 844 });
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** A 2400 × 1600 landscape-like JPEG with grain, about a megabyte. */
async function photo(): Promise<Buffer> {
  const width = 2400;
  const height = 1600;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#9fb3c4"/>
    <path d="M0 1000 L600 600 L1100 850 L1700 500 L2400 900 L2400 1600 L0 1600 Z" fill="#5b6a52"/>
  </svg>`;
  const grain = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: "gaussian", mean: 128, sigma: 14 },
    },
  })
    .raw()
    .toBuffer();
  return sharp(Buffer.from(svg))
    .composite([{ input: grain, raw: { width, height, channels: 3 }, blend: "overlay" }])
    .removeAlpha()
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** Removes files a test made; a poster is unlinked first, as the API requires. */
async function removeMedia(request: APIRequestContext, ids: string[]) {
  for (const id of ids) {
    const item = await request.get(`/api/v1/admin/media/${id}`);
    if (item.status() !== 200) continue;
    if (((await item.json()) as AdminMedia).poster) {
      await request.patch(`/api/v1/admin/media/${id}`, { data: { posterMediaId: null } });
    }
  }
  for (const id of ids) {
    const response = await request.delete(`/api/v1/admin/media/${id}`);
    expect([204, 404]).toContain(response.status());
  }
}

/** The library item uploaded under `name`, from the API. */
async function findByName(request: APIRequestContext, name: string): Promise<AdminMedia> {
  const response = await request.get(
    `/api/v1/admin/media?q=${encodeURIComponent(name)}&pageSize=10`,
  );
  const { items } = (await response.json()) as { items: AdminMedia[] };
  const item = items.find((candidate) => candidate.originalName === name);
  expect(item, `${name} is in the library`).toBeTruthy();
  return item!;
}

test("an editor uploads a JPEG with progress, writes alt text in three languages and a focus point", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  test.setTimeout(120_000);
  const tag = randomUUID().slice(0, 8);
  const name = `e2e-dag-${info.project.name}-${tag}.jpg`;
  await sizeFor(page, isMobile);
  await signInEditor(page, `jpeg-${info.project.name}`, baseURL!);
  const created: string[] = [];

  try {
    await page.goto("/admin/media");
    await waitForShell(page);
    expect(await overflow(page)).toBe(0);

    // Hold the PUT to the bucket for a moment, so the progress can be seen.
    await page.route(
      (url) => url.pathname.includes("/uploads/"),
      async (route) => {
        if (route.request().method() === "PUT") await new Promise((done) => setTimeout(done, 1500));
        await route.continue();
      },
    );
    await page.getByLabel("Yüklənəcək fayllar").setInputFiles({
      name,
      mimeType: "image/jpeg",
      buffer: await photo(),
    });
    const row = page.locator(`[data-upload="${name}"]`);
    await expect(row.getByRole("progressbar", { name: `${name} göndərilir` })).toBeVisible();
    await expect(row.getByRole("status")).toHaveText(/Kitabxanaya əlavə edildi/, {
      timeout: 60_000,
    });
    await expect(row).toContainText("Saytda görünməsi üçün alt mətn yazın.");
    await page.unroute((url) => url.pathname.includes("/uploads/"));

    const uploaded = await findByName(page.request, name);
    created.push(uploaded.id);
    expect(uploaded).toMatchObject({ kind: "image", missingAlt: true, width: 2400 });

    await row.getByRole("link", { name: /Faylı aç/ }).click();
    await expect(page).toHaveURL(`/admin/media/${uploaded.id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    expect(await overflow(page)).toBe(0);

    await page.getByLabel("Alt mətn (Azərbaycanca)").fill("Kəlbəcər dağları");
    for (const [tab, label, text] of [
      ["EN", "Alt mətn (İngiliscə)", "Kalbajar mountains"],
      ["RU", "Alt mətn (Rusca)", "Горы Кельбаджара"],
    ] as const) {
      await page
        .getByRole("tablist", { name: "Alt mətn" })
        .getByRole("tab", { name: new RegExp(tab) })
        .click();
      await page.getByLabel(label).fill(text);
    }

    // A tap a quarter across and a third down, then one step right by keyboard.
    const picker = page.locator("[data-focus-picker]");
    const box = (await picker.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.3);
    const handle = picker.getByRole("button", { name: /Fokus nöqtəsi/ });
    await expect(handle).toHaveAccessibleName(/soldan 25%, yuxarıdan 30%/);
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(handle).toHaveAccessibleName(/soldan 26%, yuxarıdan 30%/);

    await page.getByRole("button", { name: "Yadda saxla" }).click();
    await expect(page.getByText("Dəyişikliklər yadda saxlanıldı")).toBeVisible();

    const saved = (await (
      await page.request.get(`/api/v1/admin/media/${uploaded.id}`)
    ).json()) as AdminMediaDetail;
    expect(saved).toMatchObject({
      alt: { az: "Kəlbəcər dağları", en: "Kalbajar mountains", ru: "Горы Кельбаджара" },
      missingAlt: false,
    });
    expect(saved.focusX).toBeCloseTo(0.26, 2);
    expect(saved.focusY).toBeCloseTo(0.3, 2);

    // In the grid, found by its alt text.
    await page.goto(`/admin/media?axtar=${encodeURIComponent("Kəlbəcər dağları")}`);
    const tile = page.locator(`[data-media-id="${uploaded.id}"]`);
    await expect(tile).toContainText("Kəlbəcər dağları");
    await expect(tile.getByRole("link", { name })).toBeVisible();
    await expect(tile).not.toContainText("Alt mətn yoxdur");
    expect(await overflow(page)).toBe(0);
  } finally {
    await removeMedia(page.request, created);
  }
});

test("a video uploaded through the browser gets a poster frame captured from it", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  test.setTimeout(120_000);
  const name = `e2e-kend-${info.project.name}-${randomUUID().slice(0, 8)}.mp4`;
  await sizeFor(page, isMobile);
  await signInEditor(page, `video-${info.project.name}`, baseURL!);
  const created: string[] = [];

  try {
    await page.goto("/admin/media");
    await waitForShell(page);
    await page.getByLabel("Yüklənəcək fayllar").setInputFiles({
      name,
      mimeType: "video/mp4",
      buffer: Buffer.from(playableH264Mp4()),
    });
    const row = page.locator(`[data-upload="${name}"]`);
    await expect(row.getByRole("status")).toHaveText(/Kitabxanaya əlavə edildi/, {
      timeout: 60_000,
    });
    await expect(row).not.toContainText("Poster kadrı götürülmədi");

    const video = await findByName(page.request, name);
    created.push(video.id);
    expect(video).toMatchObject({ kind: "video", codec: "avc1.42c01e", width: 256 });
    expect(video.poster, "the captured frame is linked as the poster").not.toBeNull();
    created.unshift(video.poster!.id);

    const poster = (await (
      await page.request.get(`/api/v1/admin/media/${video.poster!.id}`)
    ).json()) as AdminMediaDetail;
    expect(poster).toMatchObject({
      kind: "image",
      width: 256,
      height: 144,
      decorative: true,
      originalName: name.replace(/\.mp4$/, "-poster.jpg"),
      usages: [{ entityType: "media", entityId: video.id, field: "poster" }],
    });

    // The video's page shows the poster and can capture another frame.
    await page.goto(`/admin/media/${video.id}`);
    await expect(page.locator(`[data-poster="${video.poster!.id}"]`)).toBeVisible();
    // Scrub to another moment, as an editor would, and capture what is on screen.
    await page
      .getByLabel(`Video: ${name}`)
      .evaluate((element: HTMLVideoElement) => (element.currentTime = 0.6));
    await page.getByRole("button", { name: "Bu kadrı poster et" }).click();
    await expect(page.getByText("Poster yeniləndi")).toBeVisible();
    const recaptured = (await (
      await page.request.get(`/api/v1/admin/media/${video.id}`)
    ).json()) as AdminMedia;
    expect(recaptured.poster?.id).not.toBe(video.poster!.id);
    created.unshift(recaptured.poster!.id);
  } finally {
    await removeMedia(page.request, created);
  }
});

test("deleting an image in use shows where it is used", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  test.setTimeout(90_000);
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  await sizeFor(page, isMobile);
  await signInEditor(page, `delete-${info.project.name}`, baseURL!);

  // An image through the API's presigned flow, then a draft article using it.
  const jpeg = await sharp({
    create: { width: 640, height: 400, channels: 3, background: "#857b6d" },
  })
    .jpeg()
    .toBuffer();
  const ticket = (await (
    await page.request.post("/api/v1/admin/media/uploads", {
      data: { filename: "cover.jpg", mimeType: "image/jpeg", size: jpeg.byteLength },
    })
  ).json()) as UploadTicket;
  expect(
    (
      await page.request.fetch(ticket.url, { method: "PUT", headers: ticket.headers, data: jpeg })
    ).status(),
  ).toBe(200);
  const image = (await (
    await page.request.post("/api/v1/admin/media", {
      data: { key: ticket.key, alt: { az: "Üz şəkli" }, originalName: `cover-${tag}.jpg` },
    })
  ).json()) as AdminMedia;

  const slug = `e2e-media-${tag}`;
  const { db, close } = connect(databaseUrl());
  try {
    await db.insert(news).values({
      slug,
      title: { az: "E2E media xəbəri" },
      body: { az: paragraphs("Mətn") },
      coverMediaId: image.id,
    });

    await page.goto(`/admin/media/${image.id}`);
    await waitForShell(page);
    await page.getByRole("button", { name: "Faylı sil" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Fayl silinsin?" });
    await dialog.getByRole("button", { name: "Faylı sil" }).click();
    const blocked = page.locator("[data-blocked]");
    await expect(blocked).toContainText("Fayl istifadə olunur, silinmədi.");
    await expect(blocked.getByRole("link", { name: `Xəbərin üz şəkli: ${slug}` })).toHaveAttribute(
      "href",
      "/admin/xeberler",
    );
    await expect(page.locator("[data-usages]").first()).toContainText(slug);
    expect((await page.request.get(`/api/v1/admin/media/${image.id}`)).status()).toBe(200);
  } finally {
    await db.delete(news).where(eq(news.slug, slug));
    await close();
    await removeMedia(page.request, [image.id]);
  }
});

test("only the console's pages may connect to the object store", async ({ request, isMobile }) => {
  test.skip(isMobile, "headers do not depend on the device");
  const storage = new URL(process.env.S3_ENDPOINT!).origin;
  const connectSrc = (policy: string | undefined) =>
    policy?.split("; ").find((directive) => directive.startsWith("connect-src"));

  for (const path of ["/admin/giris", "/admin/sifre-berpa"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(connectSrc(response.headers()["content-security-policy"]), path).toBe(
      `connect-src 'self' ${storage}`,
    );
  }
  // Public pages may send analytics hits (#29), never reach the object store.
  for (const path of ["/", "/en/menziller", "/api/health"]) {
    const response = await request.get(path);
    expect(connectSrc(response.headers()["content-security-policy"]), path).toBe(
      ["connect-src 'self'", ...analyticsOrigins.connect].join(" "),
    );
  }
});
