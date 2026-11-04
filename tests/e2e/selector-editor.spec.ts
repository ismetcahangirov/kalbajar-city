import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import type { AdminBlock } from "@/shared/inventory";
import type { AdminMedia, UploadTicket } from "@/shared/media";
import type { AdminSelectorView } from "@/shared/selector";

import { ensureAccount, signIn, waitForShell } from "./console";
import { waitForHydration } from "./hydration";

/**
 * The console's polygon editor (#19): staff set a block's facade picture,
 * draw a hotspot per floor with the pointer and with the keyboard, and the
 * public selector then shows that block on the picture. Each project draws on
 * a block of its own (other specs use A, B, G, H and I) and clears it after.
 */

async function uploadFacade(page: Page, alt: string): Promise<AdminMedia> {
  // A plain test card: never a picture of the complex (CLAUDE.md → Imagery).
  const jpeg = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: "#b8ad9c" },
  })
    .jpeg()
    .toBuffer();
  const ticket = (await (
    await page.request.post("/api/v1/admin/media/uploads", {
      data: { filename: "facade.jpg", mimeType: "image/jpeg", size: jpeg.byteLength },
    })
  ).json()) as UploadTicket;
  const put = await page.request.fetch(ticket.url, {
    method: "PUT",
    headers: ticket.headers,
    data: jpeg,
  });
  expect(put.status()).toBe(200);
  const created = await page.request.post("/api/v1/admin/media", {
    data: { key: ticket.key, alt: { az: alt }, originalName: `${alt}.jpg` },
  });
  expect(created.status()).toBe(201);
  return (await created.json()) as AdminMedia;
}

test("staff draw a block's floors on its facade and the public selector shows them", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  test.setTimeout(120_000);
  const code = isMobile ? "F" : "E";
  const email = `e2e-selector-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("owner", email, "E2E Selector Owner");
  await signIn(page, email, baseURL!);

  const blocks = (await (await page.request.get("/api/v1/admin/blocks")).json()) as AdminBlock[];
  const block = blocks.find((item) => item.code === code);
  expect(block, `the seed has block ${code}`).toBeTruthy();
  const alt = `Seçici testi ${code} ${randomUUID().slice(0, 6)}`;
  const image = await uploadFacade(page, alt);

  const viewOf = async () =>
    (await (
      await page.request.get(`/api/v1/admin/selector?block=${block!.id}`)
    ).json()) as AdminSelectorView;

  try {
    await page.goto("/admin/menziller/secici");
    await waitForShell(page);
    await page.getByLabel("Şəkil", { exact: true }).click();
    await page.getByRole("option", { name: `${code} blok: fasad (mərtəbələr)` }).click();

    await page.getByRole("button", { name: "Şəkil seç" }).click();
    await page.getByRole("button", { name: `Seç: ${alt}` }).click();
    await expect(page.getByText("Şəkil yadda saxlanıldı.").first()).toBeVisible();
    await expect(page.getByTestId("selector-progress")).toContainText("0 / 4 sahə çəkilib.");

    const canvas = page.getByTestId("selector-canvas");
    const floors = (await viewOf()).hotspots;
    expect(floors.map((item) => item.label)).toEqual(["4", "3", "2", "1"]);

    for (const [index, floor] of floors.entries()) {
      await page.getByRole("button", { name: new RegExp(`^Mərtəbə ${floor.label}\\b`) }).click();
      const top = 0.1 + index * 0.2;
      if (index === 0) {
        // The keyboard: the cursor starts in the middle and moves 5 % with Shift.
        await canvas.focus();
        const press = async (key: string, times = 1) => {
          for (let i = 0; i < times; i++) await page.keyboard.press(key);
        };
        await press("Shift+ArrowLeft", 8); // x 0.1
        await press("Shift+ArrowUp", 8); // y 0.1
        await press("Enter");
        await press("Shift+ArrowRight", 16); // x 0.9
        await press("Enter");
        await press("Shift+ArrowDown", 3); // y 0.25
        await press("Enter");
        await press("Shift+ArrowLeft", 16);
        await press("Enter");
        await press("Enter"); // a fifth, duplicate point …
        await press("Backspace"); // … removed again
      } else {
        const box = (await canvas.boundingBox())!;
        for (const [x, y] of [
          [0.1, top],
          [0.9, top],
          [0.9, top + 0.15],
          [0.1, top + 0.15],
        ] as const) {
          await page.mouse.click(box.x + x * box.width, box.y + y * box.height);
        }
      }
      await expect(page.getByRole("status").filter({ hasText: "4 nöqtə" })).toBeVisible();
      await page.getByRole("button", { name: "Sahəni yadda saxla" }).click();
      await expect(page.getByTestId("selector-progress")).toContainText(
        `${index + 1} / 4 sahə çəkilib.`,
      );
    }

    const drawn = await viewOf();
    expect(drawn.picture?.id).toBe(image.id);
    expect(drawn.hotspots[0]!.polygon).toEqual([
      [0.1, 0.1],
      [0.9, 0.1],
      [0.9, 0.25],
      [0.1, 0.25],
    ]);
    for (const hotspot of drawn.hotspots.slice(1)) {
      for (const [x, y] of hotspot.polygon!) {
        expect(x).toBeGreaterThanOrEqual(0.08);
        expect(x).toBeLessThanOrEqual(0.92);
        expect(y).toBeGreaterThan(0);
      }
    }

    // The public selector now draws this block on its facade.
    await page.goto(`/kompleks?blok=${code}`);
    await waitForHydration(page);
    const plan = page.locator("svg.kompleks-plan");
    await expect(plan).toHaveAttribute("data-picture", "");
    await expect(plan.locator("image")).toHaveCount(1);
    await expect(plan.locator("[data-hotspot^='mertebe-']")).toHaveCount(4);
    await expect(page.locator("figcaption")).toContainText(alt);
    const top = plan.locator("[data-hotspot='mertebe-4']");
    await expect(top).toHaveAttribute("aria-label", /^Mərtəbə 4:/);
    await top.click();
    await expect(page).toHaveURL(new RegExp(`/kompleks\\?blok=${code}&mertebe=4$`));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  } finally {
    for (const hotspot of (await viewOf()).hotspots) {
      await page.request.put("/api/v1/admin/selector/hotspot", {
        data: { level: "block", id: hotspot.id, polygon: null },
      });
    }
    await page.request.put("/api/v1/admin/selector/picture", {
      data: { level: "block", id: block!.id, mediaId: null },
    });
    await page.request.delete(`/api/v1/admin/media/${image.id}`);
  }
});
