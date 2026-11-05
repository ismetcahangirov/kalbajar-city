import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { ensureAccount, signIn, waitForShell } from "./console";
import {
  flaggedPaths,
  patchContacts,
  patchLocation,
  readContacts,
  readLocation,
  restoreFlags,
} from "./settings";

const badge = "Nümunə dəyər — təsdiqlənməlidir";

async function signInOwner(page: Page, key: string, baseURL: string) {
  const email = `e2e-settings-${key}@test.kalbajarcity.com`;
  await ensureAccount("owner", email, "E2E Settings Owner");
  await signIn(page, email, baseURL);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const flag = (page: Page, path: string) => page.locator(`[data-placeholder="${path}"]`);

/** The value of an item's first Azerbaijani text input, to follow it through a move. */
const firstText = (item: Locator) => item.locator('input[lang="az"]').first().inputValue();

test("stand-in values are flagged in the console and counted on the dashboard", async ({
  page,
  baseURL,
}, info) => {
  await signInOwner(page, `flags-${info.project.name}`, baseURL!);
  // The seed flags these; tests that change contacts never touch them.
  expect(await flaggedPaths()).toEqual(
    expect.arrayContaining(["contacts.hours", "contacts.email", "homeLocation.directions"]),
  );

  await page.goto("/admin");
  await waitForShell(page);
  const card = page.getByRole("heading", { name: /Təsdiqlənməmiş nümunə dəyərlər: \d+/ });
  await expect(card).toBeVisible();
  const hours = page.getByRole("link", { name: "Əlaqə · İş saatları" });
  await expect(hours).toBeVisible();
  expect(await overflow(page)).toBe(0);

  await hours.click();
  await expect(page).toHaveURL(/\/admin\/ayarlar$/);
  await expect(flag(page, "contacts.hours")).toContainText(badge);
  await expect(flag(page, "contacts.email")).toContainText(badge);
  // The section nav counts what is flagged in each section, in words for screen readers.
  const nav = page.getByRole("navigation", { name: "Ayarların bölmələri" });
  await expect(
    nav.getByRole("link", { name: /Əlaqə .*nümunə dəyər təsdiqlənməyib/ }),
  ).toBeVisible();
  expect(await overflow(page)).toBe(0);

  await nav.getByRole("link", { name: /Yerləşmə/ }).click();
  await expect(page).toHaveURL(/\/admin\/ayarlar\/yerlesme$/);
  await expect(flag(page, "homeLocation.directions")).toContainText(badge);
  expect(await overflow(page)).toBe(0);
});

test("the distances and amenities lists are edited by keyboard alone", async ({
  page,
  baseURL,
}, info) => {
  await signInOwner(page, `keys-${info.project.name}`, baseURL!);
  await page.goto("/admin/ayarlar/yerlesme");
  await waitForShell(page);

  const distances = page.getByRole("group", { name: "Məsafələr" });
  const items = distances.getByRole("listitem");
  if ((await items.count()) < 2) {
    // An empty list on a database the stand-ins never reached: add two first.
    const add = distances.getByRole("button", { name: "Məsafə əlavə et" });
    for (const name of ["A", "B"]) {
      await add.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.type(name);
    }
  }
  const count = await items.count();
  const first = await firstText(items.nth(0));
  const second = await firstText(items.nth(1));

  // Down: the item moves and focus follows it, and the move is announced.
  await items
    .nth(0)
    .getByRole("button", { name: /^Aşağı apar/ })
    .focus();
  await page.keyboard.press("Enter");
  expect(await firstText(items.nth(0))).toBe(second);
  expect(await firstText(items.nth(1))).toBe(first);
  await expect(items.nth(1).getByRole("button", { name: /^Aşağı apar/ })).toBeFocused();
  await expect(distances.locator("[aria-live]")).toContainText("2-ci yerdədir");

  // Up again, from where focus is, with the keyboard.
  await page.keyboard.press("Shift+Tab");
  await expect(items.nth(1).getByRole("button", { name: /^Yuxarı apar/ })).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await firstText(items.nth(0))).toBe(first);
  await expect(items.nth(0).getByRole("button", { name: /^Aşağı apar/ })).toBeFocused();

  // Remove: the neighbour's remove button takes focus.
  await items.nth(0).getByRole("button", { name: /^Sil/ }).focus();
  await page.keyboard.press("Enter");
  await expect(items).toHaveCount(count - 1);
  expect(await firstText(items.nth(0))).toBe(second);
  await expect(items.nth(0).getByRole("button", { name: /^Sil/ })).toBeFocused();

  // Add: focus lands in the new item's first field.
  await distances.getByRole("button", { name: "Məsafə əlavə et" }).focus();
  await page.keyboard.press("Enter");
  await expect(items).toHaveCount(count);
  await page.keyboard.type("E2E");
  expect(await firstText(items.nth(count - 1))).toBe("E2E");
  expect(await overflow(page)).toBe(0);

  // The amenities list uses the same editor. The edits above are unsaved, so
  // leaving asks first; this test means to leave.
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/admin/ayarlar/kompleks");
  const amenities = page.getByRole("group", { name: "Üstünlüklər" });
  const rows = amenities.getByRole("listitem");
  await expect(rows.first()).toBeVisible();
  const top = await firstText(rows.nth(0));
  await rows
    .nth(1)
    .getByRole("button", { name: /^Yuxarı apar/ })
    .focus();
  await page.keyboard.press("Enter");
  expect(await firstText(rows.nth(1))).toBe(top);
  // At the top, "up" is disabled, so focus moves to the next control of the item.
  await expect(rows.nth(0).getByRole("button", { name: /^Aşağı apar/ })).toBeFocused();
  expect(await overflow(page)).toBe(0);
});

// Changes shared settings and restores them, so it runs once, on desktop.
test.describe("saving in the console", () => {
  test.skip(({ isMobile }) => isMobile, "changes shared settings");
  test.describe.configure({ mode: "serial" });

  test("a new address and distance show on the next request and lose their flags", async ({
    page,
    baseURL,
  }) => {
    const tag = randomUUID().slice(0, 8);
    await signInOwner(page, "save", baseURL!);
    const originalAddress = (await readContacts(page.request)).address;
    const originalDistances = (await readLocation(page.request)).distances;
    const flags = (await flaggedPaths()).filter((path) =>
      ["contacts.address", "homeLocation.distances"].includes(path),
    );

    try {
      await page.goto("/admin/ayarlar");
      await waitForShell(page);
      const address = `Kəlbəcər, E2E küçəsi ${tag}`;
      await page.getByRole("textbox", { name: "Ünvan (Azərbaycanca)" }).fill(address);
      await page.getByRole("button", { name: "Yadda saxla" }).click();
      await expect(page.getByText("Ayarlar yadda saxlanıldı")).toBeVisible();
      await expect(flag(page, "contacts.address")).toHaveCount(0);
      // Fields the save left alone stay flagged.
      await expect(flag(page, "contacts.hours")).toBeVisible();

      await page.goto("/elaqe");
      await expect(page.locator("address").filter({ hasText: address })).toBeVisible();

      await page.goto("/admin/ayarlar/yerlesme");
      const distances = page.getByRole("group", { name: "Məsafələr" });
      const add = distances.getByRole("button", { name: "Məsafə əlavə et" });
      await add.click();
      const place = `E2E yeri ${tag}`;
      const item = distances.getByRole("listitem").last();
      await item.getByRole("textbox", { name: "Yer (Azərbaycanca)" }).fill(place);
      await item.getByRole("textbox", { name: "Dəqiqə" }).fill("12");
      await page.getByRole("button", { name: "Yadda saxla" }).click();
      await expect(page.getByText("Ayarlar yadda saxlanıldı")).toBeVisible();
      await expect(flag(page, "homeLocation.distances")).toHaveCount(0);
      await expect(flag(page, "homeLocation.directions")).toBeVisible();

      await page.goto("/yerlesme");
      await expect(page.getByText(place)).toBeVisible();
    } finally {
      await patchContacts(page.request, { address: originalAddress });
      await patchLocation(page.request, { distances: originalDistances });
      await restoreFlags(page.request, flags);
    }
  });
});
