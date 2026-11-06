import { expect, test } from "@playwright/test";

import { ensureAccount, signIn, waitForShell } from "./console";

type AdminItem = { id: string; slug: string; number: string; block: string };

// The critical flow's other half (#30): the inquiry journey is in
// quality-keyboard.spec.ts; this is what the sales team does after it. Each
// viewport changes an apartment of its own block and puts it back, so the two
// projects never touch the same row (inventory.spec.ts uses G and H, api.spec.ts I).
test("a status changed in the console shows on the public pages on the next request", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  const block = isMobile ? "F" : "E";
  const email = `e2e-critical-flow-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("sales", email, "E2E Critical Flow");
  await signIn(page, email, baseURL!);

  const listed = await page.request.get(
    `/api/v1/admin/apartments?block=${block}&status=available&pageSize=1`,
  );
  const [target] = ((await listed.json()) as { items: AdminItem[] }).items;
  expect(target, `the seed has available apartments in block ${block}`).toBeTruthy();

  // Read both public pages first, so a stale cached copy is what the next read would get.
  const card = page
    .locator("article")
    .filter({ has: page.locator(`a[href$="/menziller/${target!.slug}"]`) });
  const status = page.locator("main p").filter({ hasText: "Vəziyyət:" });
  await page.goto(`/menziller?blok=${block}`);
  await expect(card).toContainText("Satışda");
  await page.goto(`/menziller/${target!.slug}`);
  await expect(status).toContainText("Satışda");

  try {
    await page.goto(`/admin/menziller/${target!.id}`);
    await waitForShell(page);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Satılıb" }).click();
    await page.getByRole("button", { name: "Yadda saxla" }).click();
    await expect(page.getByText("Dəyişikliklər yadda saxlanıldı.")).toBeVisible();

    await page.goto(`/menziller/${target!.slug}`);
    await expect(status).toContainText("Satılıb");
    await page.goto(`/en/menziller/${target!.slug}`);
    await expect(page.locator("main p").filter({ hasText: "Status:" })).toContainText("Sold");
    await page.goto(`/menziller?blok=${block}`);
    await expect(card).toContainText("Satılıb");
  } finally {
    // Sales may set the status too, and the next run needs the row as it was.
    const restored = await page.request.patch(`/api/v1/admin/apartments/${target!.id}`, {
      data: { status: "available" },
    });
    expect(restored.status()).toBe(200);
  }

  await page.goto(`/menziller/${target!.slug}`);
  await expect(status).toContainText("Satışda");
});
