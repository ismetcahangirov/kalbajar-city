import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import type { AdminRedirect } from "@/shared/redirects";

import { ensureAccount, signIn, waitForShell } from "./console";

async function signInOwner(page: Page, key: string, baseURL: string) {
  const email = `e2e-redirects-${key}@test.kalbajarcity.com`;
  await ensureAccount("owner", email, "E2E Redirects Owner");
  await signIn(page, email, baseURL);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function fill(page: Page, from: string, to: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Haradan").fill(from);
  await dialog.getByLabel("Haraya").fill(to);
  await dialog.getByRole("button", { name: "Əlavə et" }).click();
}

test("a redirect added in the console is served without a deploy, and loops are refused", async ({
  page,
  request,
  baseURL,
}, info) => {
  const key = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  info.annotations.push({ type: "key", description: key });
  await signInOwner(page, info.project.name, baseURL!);
  const source = `/e2e-kohne-${key}`;

  await page.goto("/admin/yonlendirmeler");
  await waitForShell(page);
  await expect(page.getByRole("heading", { level: 1, name: "Yönləndirmələr" })).toBeVisible();
  expect(await overflow(page)).toBe(0);

  await page.getByRole("button", { name: "Yeni yönləndirmə" }).click();
  await fill(page, `${source}/`, "/elaqe");
  await expect(page.getByText("Yönləndirmə əlavə edildi")).toBeVisible();
  await expect(page.getByText(source, { exact: true }).locator("visible=true")).toHaveCount(1);

  // The proxy reloads its copy of the table within a few seconds.
  await expect
    .poll(
      async () => (await request.get(`${source}?utm_source=e2e`, { maxRedirects: 0 })).status(),
      {
        timeout: 20_000,
      },
    )
    .toBe(301);
  const served = await request.get(`${source}?utm_source=e2e`, { maxRedirects: 0 });
  // Next sends a same-origin Location relative, so no host name leaks into it.
  expect(served.headers().location).toBe("/elaqe?utm_source=e2e");

  // A redirect back to the source would loop.
  await page.getByRole("button", { name: "Yeni yönləndirmə" }).click();
  await fill(page, "/elaqe", source);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    `Yönləndirmə dövrə yaradır: /elaqe → ${source} → /elaqe`,
  );
  await page.getByRole("dialog").getByRole("button", { name: "İmtina" }).click();

  // One pointing at the source forms a chain; resolving it points it at /elaqe.
  const chained = `/e2e-zencir-${key}`;
  await page.getByRole("button", { name: "Yeni yönləndirmə" }).click();
  await fill(page, chained, source);
  await expect(page.getByRole("alertdialog")).toContainText("Yönləndirmə zənciri yaranır");
  await page.getByRole("button", { name: "Birbaşa yönləndir" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText(chained, { exact: true }).locator("visible=true")).toHaveCount(1);

  const mine = await redirectsOf(page, key);
  expect(mine.find((row) => row.fromPath === chained)?.toPath).toBe("/elaqe");
  expect(mine.find((row) => row.fromPath === source)?.hits).toBeGreaterThanOrEqual(1);
});

async function redirectsOf(page: Page, key: string): Promise<AdminRedirect[]> {
  const list = (await (
    await page.request.get("/api/v1/admin/redirects")
  ).json()) as AdminRedirect[];
  return list.filter((row) => row.fromPath.includes(key));
}

// Nothing this test saved outlives it, even when it fails half-way.
test.afterEach(async ({ page }, info) => {
  const key = (info.annotations.find((note) => note.type === "key")?.description ?? "").trim();
  if (!key) return;
  for (const row of await redirectsOf(page, key)) {
    await page.request.delete(`/api/v1/admin/redirects/${row.id}`);
  }
});
