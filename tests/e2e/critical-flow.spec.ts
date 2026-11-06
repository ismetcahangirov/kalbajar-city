import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { leadEvents, leads } from "@/db/schema";
import az from "@/i18n/messages/az.json";

import { ensureAccount, signIn, waitForShell } from "./console";
import { waitForHydration } from "./hydration";

// Mailpit's API (docker compose maps it to 8035; CI sets MAILPIT_URL).
const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8035";

type AdminItem = { id: string; slug: string; number: string; block: string };

// The critical flow's other half (#30): the keyboard-only inquiry
// journey is in quality-keyboard.spec.ts; this is what the sales team does after it. Each
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

// The whole critical flow in one test (#30), with a pointer or a finger: a
// visitor goes home → catalogue → apartment → inquiry, then a salesperson
// finds that very lead in the console with the apartment attached. The name is
// unique per project and run, so the two viewports never meet, and the visitor
// has an IP of their own so the leads rate limit never decides the test.
test("an inquiry sent from an apartment page reaches the console leads list", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  // Seven page loads, a three-second form trap and a sign-in: well past the
  // default 30 s on a loaded machine.
  test.setTimeout(90_000);
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const name = `E2E journey ${tag}`;
  const octet = Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${octet}.${octet}` });

  try {
    await page.goto("/");
    await waitForHydration(page);
    const banner = page.getByRole("banner");
    const curtain = page.locator("[data-page-curtain]");
    if (isMobile) {
      // Below lg the header only has the burger; the menu has the links.
      await banner.getByRole("button", { name: az.Shell.openMenu }).click();
      await page
        .getByRole("dialog", { name: az.Shell.menu })
        .getByRole("link", { name: az.Shell.chooseApartment })
        .click();
    } else {
      await banner.getByRole("link", { name: az.Shell.chooseApartment }).click();
    }
    await expect(page).toHaveURL(/\/menziller$/);
    await waitForHydration(page);
    // On desktop the curtain covers the page until the new one is ready.
    await expect(curtain).not.toHaveAttribute("data-state");

    await page.locator('main a[href^="/menziller/"]').first().click();
    await expect(page).toHaveURL(/\/menziller\/[a-z0-9-]+$/);
    await waitForHydration(page);
    await expect(curtain).not.toHaveAttribute("data-state");
    const slug = new URL(page.url()).pathname.split("/").pop()!;

    if (isMobile) {
      await banner.getByRole("button", { name: az.Shell.openMenu }).click();
      await page
        .getByRole("dialog", { name: az.Shell.menu })
        .getByRole("link", { name: az.Shell.inquire })
        .click();
    } else {
      await banner.getByRole("link", { name: az.Shell.inquire }).click();
    }
    const dialog = page.getByRole("dialog", { name: az.Shell.inquire });
    await expect(dialog).toBeVisible();
    const submit = dialog.getByRole("button", { name: az.LeadForm.submit.inquiry });
    await expect(submit).toBeVisible();
    const shown = Date.now();

    await dialog.getByLabel(az.LeadForm.name).fill(name);
    await dialog.getByLabel(az.LeadForm.phone).fill("050 123 45 67");
    await dialog.getByRole("checkbox").check();
    // The form's time trap drops anything sent within three seconds.
    await page.waitForTimeout(Math.max(0, 3500 - (Date.now() - shown)));
    await submit.click();
    await expect(dialog.getByText(az.LeadForm.success.title)).toBeVisible();

    const email = `e2e-critical-journey-${info.project.name}@test.kalbajarcity.com`;
    await ensureAccount("sales", email, "E2E Critical Journey");
    await signIn(page, email, baseURL!);
    await page.goto("/admin/muracietler");
    await waitForShell(page);

    const link = page.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const row = isMobile
      ? page.getByRole("listitem").filter({ has: link })
      : page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText("Yeni");
    await link.click();

    await expect(page).toHaveURL(/\/admin\/muracietler\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByTestId("lead-timeline")).toContainText("Müraciət saytdan gəldi");
    await expect(page.locator(`main a[href="/menziller/${slug}"]`)).toBeVisible();
  } finally {
    const { db, close } = connect(databaseUrl());
    try {
      // The notification is recorded on the lead after the answer; deleting
      // the lead first would fail that write.
      await expect
        .poll(async () => {
          const [row] = await db.select({ id: leads.id }).from(leads).where(eq(leads.name, name));
          if (!row) return "notified";
          const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, row.id));
          return events.some((event) => event.type === "notified") ? "notified" : "pending";
        })
        .toBe("notified");
      await db.delete(leads).where(eq(leads.name, name));
    } finally {
      await close();
    }
    // The sales e-mail the lead triggered; best effort, as in leads-crm.spec.ts.
    try {
      const found = (await (
        await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(tag)}`)
      ).json()) as { messages: Array<{ ID: string }> };
      const ids = found.messages.map((message) => message.ID);
      if (ids.length) {
        await fetch(`${mailpit}/api/v1/messages`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ IDs: ids }),
        });
      }
    } catch {
      // Mailpit is a convenience here; leads.spec.ts checks the e-mail itself.
    }
  }
});
