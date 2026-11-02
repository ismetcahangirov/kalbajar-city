import { expect, test, type APIRequestContext } from "@playwright/test";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { connect, databaseUrl } from "@/db/client";
import { homeSections } from "@/db/schema";
import { setOwner } from "@/lib/auth/owner";
import type { AdminMedia, MediaUsage, UploadTicket } from "@/shared/media";

const email = "e2e-media@test.kalbajarcity.com";
const password = "an e2e passphrase that is long";

// The home page's about image is changed and restored, so the file runs once,
// on desktop, in one worker; the 390 px view gets its own browser context.
test.skip(({ isMobile }) => isMobile, "the 390 px check opens its own phone-sized context");
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({}, testInfo) => {
  // Skipped tests still run beforeAll; two projects must not create the owner at once.
  if (testInfo.project.name !== "desktop") return;
  const { db, close } = connect(databaseUrl());
  try {
    await setOwner(db, { email, name: "E2E Media Owner", password });
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

/**
 * A generated 6000 × 4000 JPEG: a mountain landscape with film grain, about
 * 9 MB, the size of a camera original.
 */
async function landscape(): Promise<Buffer> {
  const width = 6000;
  const height = 4000;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb0cc"/><stop offset="1" stop-color="#ece3d2"/></linearGradient>
      <linearGradient id="near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55654c"/><stop offset="1" stop-color="#26301f"/></linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#sky)"/>
    <path d="M0 2300 L700 1500 L1300 1900 L2100 1200 L2900 1800 L3600 1350 L4500 2000 L5200 1600 L6000 2100 L6000 4000 L0 4000 Z" fill="#8a948f"/>
    <path d="M0 2900 L900 2300 L1700 2700 L2600 2200 L3500 2800 L4400 2400 L5200 2900 L6000 2500 L6000 4000 L0 4000 Z" fill="url(#near)"/>
  </svg>`;
  const grain = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: "gaussian", mean: 128, sigma: 18 },
    },
  })
    .raw()
    .toBuffer();
  return sharp(Buffer.from(svg))
    .composite([{ input: grain, raw: { width, height, channels: 3 }, blend: "overlay" }])
    .removeAlpha()
    .jpeg({ quality: 88 })
    .toBuffer();
}

test("an editor's 6000 px JPEG reaches a 390 px phone as a variant under 200 KB", async ({
  request,
  browser,
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await signIn(request, baseURL!);

  const jpeg = await landscape();
  expect(jpeg.byteLength).toBeGreaterThan(1024 * 1024);

  const ticketResponse = await request.post("/api/v1/admin/media/uploads", {
    data: { filename: "dag.jpg", mimeType: "image/jpeg", size: jpeg.byteLength },
  });
  expect(ticketResponse.status()).toBe(201);
  const ticket = (await ticketResponse.json()) as UploadTicket;
  // Straight to the bucket, as the console's browser does.
  const put = await request.fetch(ticket.url, {
    method: ticket.method,
    headers: ticket.headers,
    data: jpeg,
  });
  expect(put.status()).toBe(200);

  const createdResponse = await request.post("/api/v1/admin/media", {
    data: {
      key: ticket.key,
      source: "generated",
      alt: { az: "Dağ mənzərəsi", en: "Mountain view", ru: "Вид на горы" },
    },
  });
  expect(createdResponse.status()).toBe(201);
  const item = (await createdResponse.json()) as AdminMedia;
  expect(item).toMatchObject({ width: 6000, height: 4000, illustrative: true });
  expect(item.variants.map((variant) => variant.width)).toEqual([
    480, 480, 960, 960, 1600, 1600, 2400, 2400,
  ]);

  const { db, close } = connect(databaseUrl());
  const [about] = await db.select().from(homeSections).where(eq(homeSections.key, "about"));
  expect(about, "the seed has an about section").toBeTruthy();
  const original = about!.content;

  try {
    await db
      .update(homeSections)
      .set({ content: { ...original, mediaId: item.id } })
      .where(eq(homeSections.id, about!.id));
    // A console edit of the file revalidates the pages that show it.
    const patched = await request.patch(`/api/v1/admin/media/${item.id}`, {
      data: { focusX: 0.5, focusY: 0.4 },
    });
    expect(patched.status()).toBe(200);

    await test.step("a 390 px phone loads a small variant", async () => {
      const phone = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: "az-AZ",
        baseURL,
      });
      try {
        const mobile = await phone.newPage();
        await mobile.goto("/");
        const image = mobile.locator(`img[src*="/media/${item.id}/"]`);
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
          .toBeGreaterThan(0);
        const current = await image.evaluate((img: HTMLImageElement) => img.currentSrc);
        expect(current).toMatch(new RegExp(`/media/${item.id}/(480|960|1600)\\.avif$`));
        const file = await request.get(current);
        expect(file.status()).toBe(200);
        const size = (await file.body()).byteLength;
        test
          .info()
          .annotations.push({ type: "390 px, DPR 3", description: `${current} ${size} B` });
        expect(size).toBeLessThan(200 * 1024);

        await expect(image).toHaveAttribute("alt", "Dağ mənzərəsi");
        await expect(image).toHaveAttribute("width", "6000");
        await expect(image).toHaveAttribute("height", "4000");
        await expect(
          mobile.locator(`[aria-labelledby="haqqinda"]`).getByText("İllüstrativ"),
        ).toBeVisible();
      } finally {
        await phone.close();
      }
    });

    await test.step("every public image has width, height and alt", async () => {
      for (const path of ["/", "/en", "/ru"]) {
        await page.goto(path);
        const images = await page.locator("img").evaluateAll((list) =>
          list.map((img) => ({
            src: img.getAttribute("src"),
            width: img.getAttribute("width"),
            height: img.getAttribute("height"),
            alt: img.getAttribute("alt"),
          })),
        );
        expect(images.length, `${path} shows the image`).toBeGreaterThan(0);
        for (const image of images) {
          expect(Number(image.width), `${image.src} width`).toBeGreaterThan(0);
          expect(Number(image.height), `${image.src} height`).toBeGreaterThan(0);
          expect(image.alt, `${image.src} alt`).not.toBeNull();
        }
      }
      await page.goto("/en");
      await expect(page.locator(`img[src*="/media/${item.id}/"]`)).toHaveAttribute(
        "alt",
        "Mountain view",
      );
    });

    await test.step("deleting the image in use is refused with its usages", async () => {
      const refused = await request.delete(`/api/v1/admin/media/${item.id}`);
      expect(refused.status()).toBe(409);
      const body = (await refused.json()) as { error: { code: string; usages: MediaUsage[] } };
      expect(body.error.code).toBe("MEDIA_IN_USE");
      expect(body.error.usages).toEqual([
        { entityType: "home_section", entityId: about!.id, field: "mediaId", label: "about" },
      ]);
    });

    await test.step("without alt text the image is not shown", async () => {
      const cleared = await request.patch(`/api/v1/admin/media/${item.id}`, {
        data: { alt: null },
      });
      expect(cleared.status()).toBe(200);
      expect(((await cleared.json()) as AdminMedia).missingAlt).toBe(true);
      await page.goto("/");
      await expect(page.locator("#haqqinda")).toBeAttached();
      await expect(page.locator(`img[src*="/media/${item.id}/"]`)).toHaveCount(0);
    });
  } finally {
    await db.update(homeSections).set({ content: original }).where(eq(homeSections.id, about!.id));
    await close();
    // Unused again: the delete succeeds, removes the files and revalidates the home page.
    const deleted = await request.delete(`/api/v1/admin/media/${item.id}`);
    expect(deleted.status()).toBe(204);
  }
  const gone = await request.get(item.variants[0]!.url);
  expect(gone.status()).not.toBe(200);
});
