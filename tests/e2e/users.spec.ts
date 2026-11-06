import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { ensureAccount, password, signIn, waitForShell } from "./console";

const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8035";

/** Fails on any WCAG 2.2 AA violation on the page as it is now. */
async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((node) => node.html) })),
  ).toEqual([]);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The invitation link in the e-mail to this address, which is then deleted. */
async function invitationLink(address: string): Promise<string> {
  type Summary = { ID: string; To: Array<{ Address: string }> };
  let message: Summary | undefined;
  await expect
    .poll(async () => {
      const response = await fetch(
        `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`,
      );
      [message] = ((await response.json()) as { messages: Summary[] }).messages;
      return message?.To[0]?.Address ?? "";
    })
    .toBe(address);
  const full = (await (await fetch(`${mailpit}/api/v1/message/${message!.ID}`)).json()) as {
    Text: string;
    HTML: string;
  };
  await fetch(`${mailpit}/api/v1/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: [message!.ID] }),
  });
  const link = /https?:\S+\/admin\/devet\?token=\S+/.exec(full.Text)?.[0];
  expect(link, "the e-mail carries the link").toBeTruthy();
  expect(full.HTML).toContain("Dəvəti qəbul et");
  return link!;
}

test("an owner invites a user, who accepts once; a role change and deactivation apply at once", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const key = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const ownerName = `E2E Users Flow ${info.project.name}`;
  const ownerEmail = `e2e-users-flow-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("owner", ownerEmail, ownerName);
  await signIn(page, ownerEmail, baseURL!);

  await page.goto("/admin/istifadeciler");
  await waitForShell(page);
  await expect(page.getByRole("heading", { level: 1, name: "İstifadəçilər" })).toBeVisible();
  await expect(page.getByText(ownerEmail).locator("visible=true")).toHaveCount(1);
  expect(await overflow(page)).toBe(0);
  await expectAccessible(page);
  // The signed-in owner has no actions on their own row.
  await expect(page.getByRole("button", { name: `Deaktiv et: ${ownerName}` })).toHaveCount(0);

  // Invite.
  const address = `invite-${key}@example.com`;
  await page.getByRole("button", { name: "İstifadəçi dəvət et" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Dəvət göndər" }).click();
  await expect(dialog.getByText("Bu xananı doldurun.")).toBeVisible();
  await dialog.getByLabel("E-poçt").fill(address);
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Satış" }).click();
  await dialog.getByRole("button", { name: "Dəvət göndər" }).click();
  await expect(page.getByText(`Dəvət ${address} ünvanına göndərildi.`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Gözləyən dəvətlər" })).toBeVisible();
  await expect(page.getByText(address, { exact: true }).locator("visible=true")).toHaveCount(1);
  expect(await overflow(page)).toBe(0);
  await expectAccessible(page);

  // Accept, signed out, from the e-mailed link.
  const link = await invitationLink(address);
  expect(link.startsWith(baseURL!)).toBe(true);
  const invited = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    locale: "az-AZ",
  });
  const visitor = await invited.newPage();
  await visitor.goto(link);
  await expect(visitor.getByRole("heading", { level: 1, name: "Dəvəti qəbul edin" })).toBeVisible();
  await expect(visitor.getByText(address)).toBeVisible();
  expect(await overflow(visitor)).toBe(0);
  await expectAccessible(visitor);
  const name = `Dəvətli ${key}`;
  await visitor.getByLabel("Ad və soyad").fill(name);
  await visitor.getByLabel("Şifrə", { exact: true }).fill(password);
  await visitor.getByLabel("Yeni şifrəni təkrarlayın").fill(password);
  await visitor.getByRole("button", { name: "Hesab yarat" }).click();
  await expect(visitor.getByText("Hesabınız yaradıldı.")).toBeVisible();

  // The link works once.
  await visitor.goto(link);
  await expect(visitor.getByRole("heading", { name: "Dəvət etibarsızdır" })).toBeVisible();

  // The new account signs in with its role: sales has no users screen.
  await signIn(visitor, address, baseURL!);
  await visitor.goto("/admin/muracietler");
  await expect(visitor.getByRole("heading", { level: 1, name: "Müraciətlər" })).toBeVisible();
  expect((await visitor.goto("/admin/istifadeciler"))?.status()).toBe(403);

  // A role change applies on the next request.
  await page.reload();
  await waitForShell(page);
  await expect(page.getByRole("button", { name: `Ləğv et: ${address}` })).toHaveCount(0);
  await page.getByRole("button", { name: `Rolu dəyiş: ${name}` }).click();
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: "Administrator" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yadda saxla" }).click();
  await expect(page.getByText("Rol dəyişdirildi.")).toBeVisible();
  expect((await visitor.goto("/admin/istifadeciler"))?.status()).toBe(200);

  // Deactivating ends the session at once.
  await page.getByRole("button", { name: `Deaktiv et: ${name}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deaktiv et" }).click();
  await expect(page.getByText("Hesab deaktiv edildi.")).toBeVisible();
  await visitor.goto("/admin/istifadeciler");
  await expect(visitor).toHaveURL(/\/admin\/giris/);

  // It can be undone, with a new sign-in.
  await page.getByRole("button", { name: `Aktiv et: ${name}` }).click();
  await expect(page.getByText("Hesab yenidən aktiv edildi.")).toBeVisible();
  await invited.close();
});

test("a pending invitation can be revoked, and an unknown link says so", async ({
  page,
  baseURL,
}, info) => {
  const key = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const ownerEmail = `e2e-users-revoke-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("owner", ownerEmail, `E2E Users Revoke ${info.project.name}`);
  await signIn(page, ownerEmail, baseURL!);

  const address = `revoke-${key}@example.com`;
  const created = await page.request.post("/api/v1/admin/invitations", {
    headers: { origin: baseURL! },
    data: { email: address, role: "editor" },
  });
  expect(created.status()).toBe(201);
  const link = await invitationLink(address);

  await page.goto("/admin/istifadeciler");
  await waitForShell(page);
  await page.getByRole("button", { name: `Ləğv et: ${address}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Ləğv et" }).click();
  await expect(page.getByText("Dəvət ləğv edildi.")).toBeVisible();

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Dəvət etibarsızdır" })).toBeVisible();
  await page.goto("/admin/devet?token=unknown");
  await expect(page.getByRole("heading", { name: "Dəvət etibarsızdır" })).toBeVisible();
});

test("the server refuses an owner's own demotion and keeps Better Auth's endpoint closed", async ({
  page,
  baseURL,
}, info) => {
  const ownerEmail = `e2e-users-self-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("owner", ownerEmail, `E2E Users Self ${info.project.name}`);
  await signIn(page, ownerEmail, baseURL!);
  const { user: me } = (await (await page.request.get("/api/v1/admin/me")).json()) as {
    user: { id: string };
  };

  // 403 here, or 409 `LAST_OWNER` if this were the only owner; tests/db/users.test.ts has both.
  const demote = await page.request.put(`/api/v1/admin/users/${me.id}/role`, {
    headers: { origin: baseURL! },
    data: { role: "editor" },
  });
  expect([403, 409]).toContain(demote.status());
  const off = await page.request.post(`/api/v1/admin/users/${me.id}/deactivate`, {
    headers: { origin: baseURL! },
  });
  expect([403, 409]).toContain(off.status());
  // Better Auth's own endpoint is closed.
  const banned = await page.request.post("/api/v1/auth/admin/ban-user", {
    headers: { origin: baseURL! },
    data: { userId: me.id },
  });
  expect(banned.status()).toBe(404);
});
