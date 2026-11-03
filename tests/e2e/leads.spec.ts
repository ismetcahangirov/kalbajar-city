import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { leadEvents, leads } from "@/db/schema";

import { waitForHydration } from "./hydration";

// Mailpit's API (docker compose maps it to 8035; CI sets MAILPIT_URL).
const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8035";

/** The form's time trap drops anything sent within three seconds of it appearing. */
const fillTimeMs = 3500;

/** Each test is its own visitor, so the per-IP rate limit never decides a test. */
async function asNewVisitor(page: Page) {
  const octet = Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${octet}.${octet}` });
}

/** Waits for the lead's sales e-mail to be recorded, then deletes the lead. */
async function storedLead(name: string) {
  const { db, close } = connect(databaseUrl());
  try {
    let row: typeof leads.$inferSelect | undefined;
    await expect
      .poll(async () => {
        [row] = await db.select().from(leads).where(eq(leads.name, name));
        if (!row) return [];
        const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, row.id));
        return events.map((event) => event.type);
      })
      .toContain("notified");
    await db.delete(leads).where(eq(leads.id, row!.id));
    return row!;
  } finally {
    await close();
  }
}

test("a call-back from /elaqe is stored with its source page and UTM, and e-mailed", async ({
  page,
}, testInfo) => {
  const tag = `${testInfo.project.name}-${randomUUID().slice(0, 8)}`;
  const name = `E2E ${tag}`;
  await asNewVisitor(page);
  await page.addInitScript(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  });
  await page.goto(`/elaqe?utm_source=e2e&utm_medium=test&utm_campaign=${tag}`);
  await waitForHydration(page);
  const shown = Date.now();

  const form = page.locator("#geri-zeng");
  await form.getByLabel("Adınız").fill(name);
  await form.getByLabel("Telefon").fill("050 123 45 67");
  await form.getByRole("checkbox").check();
  await page.waitForTimeout(Math.max(0, fillTimeMs - (Date.now() - shown)));
  // Enter rather than a click: below lg the action bar may cover the button.
  await form.getByRole("button", { name: "Zəng sifariş et" }).press("Enter");

  await expect(form.getByText("Müraciətiniz qəbul edildi")).toBeFocused();
  const events = await page.evaluate(
    () => (window as unknown as { dataLayer: unknown[] }).dataLayer,
  );
  expect(events).toContainEqual({ event: "generate_lead", lead_type: "callback" });

  const row = await storedLead(name);
  expect(row).toMatchObject({
    type: "callback",
    phone: "+994501234567",
    locale: "az",
    sourcePath: "/elaqe",
    utm: { source: "e2e", medium: "test", campaign: tag },
  });

  // The sales e-mail, with a link to the lead in the console.
  type Summary = { ID: string; Subject: string; To: Array<{ Address: string }> };
  let message: Summary | undefined;
  await expect
    .poll(async () => {
      const response = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(tag)}`);
      [message] = ((await response.json()) as { messages: Summary[] }).messages;
      return message?.Subject ?? "";
    })
    .toContain(name);
  expect(message!.To.map((to) => to.Address)).toEqual(["sales@e2e.kalbajarcity.test"]);
  const full = (await (await fetch(`${mailpit}/api/v1/message/${message!.ID}`)).json()) as {
    Text: string;
  };
  expect(full.Text).toContain(`/admin/muracietler/${row.id}`);
  expect(full.Text).toContain(`utm_campaign=${tag}`);
  await fetch(`${mailpit}/api/v1/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: [message!.ID] }),
  });
});

test("the form is completable with the keyboard alone and announces its errors", async ({
  page,
}, testInfo) => {
  const name = `E2E ${testInfo.project.name}-${randomUUID().slice(0, 8)}`;
  await asNewVisitor(page);
  await page.goto("/elaqe");
  await waitForHydration(page);
  const shown = Date.now();

  const form = page.locator("#geri-zeng");
  const nameField = form.getByLabel("Adınız");
  const phone = form.getByLabel("Telefon");
  const consent = form.getByRole("checkbox");
  const submit = form.getByRole("button", { name: "Zəng sifariş et" });

  async function tabTo(target: typeof submit) {
    for (let i = 0; i < 80; i++) {
      if (await target.evaluate((element) => element === document.activeElement)) return;
      await page.keyboard.press("Tab");
    }
    throw new Error("Tab never reached the element");
  }

  // Sent empty: every field is marked, the summary is announced, focus goes to the first.
  await tabTo(nameField);
  await tabTo(submit);
  await page.keyboard.press("Enter");
  for (const field of [nameField, phone, consent]) {
    await expect(field).toHaveAttribute("aria-invalid", "true");
    const describedBy = await field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy!.split(" ")[0]}"]`)).not.toBeEmpty();
  }
  await expect(form.getByRole("status")).toHaveText(
    "3 xana düzgün doldurulmayıb: Adınız, Telefon, Razılıq.",
  );
  await expect(nameField).toBeFocused();

  await page.keyboard.type(name);
  await page.keyboard.press("Tab");
  await expect(phone).toBeFocused();
  await page.keyboard.type("0501234567");
  await page.keyboard.press("Tab");
  await expect(consent).toBeFocused();
  // Leaving the field formats the number (with no-break spaces) and clears its error.
  await expect(phone).toHaveValue("+994 50 123 45 67");
  await expect(phone).not.toHaveAttribute("aria-invalid");
  await page.keyboard.press("Space");
  await expect(consent).toBeChecked();

  await tabTo(submit);
  await page.waitForTimeout(Math.max(0, fillTimeMs - (Date.now() - shown)));
  await page.keyboard.press("Enter");
  await expect(form.getByText("Müraciətiniz qəbul edildi")).toBeFocused();
  for (const field of [nameField, phone, consent]) await expect(field).toHaveCount(0);

  expect(await storedLead(name)).toMatchObject({ type: "callback", sourcePath: "/elaqe" });
});

test("the home page ends with the inquiry form", async ({ page }) => {
  await page.goto("/");
  const section = page.locator('section[aria-labelledby="muraciet"]');
  // The form's script loads only when its place nears the screen (#30).
  await section.scrollIntoViewIfNeeded();
  const form = section.locator("form");
  await expect(form).toHaveAttribute("aria-labelledby", "muraciet");
  await expect(form.getByLabel("Mesaj (istəyə bağlı)")).toBeVisible();
  await expect(form.getByRole("link", { name: /Məxfilik siyasəti/ })).toHaveAttribute(
    "href",
    "/mexfilik-siyaseti",
  );
});

test("call and WhatsApp clicks are reported to the data layer", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  });
  await page.goto("/");
  await waitForHydration(page);
  const events = await page.evaluate(() => {
    for (const name of ["click_call", "click_whatsapp"]) {
      const link = document.querySelector(`[data-track="${name}"]`);
      // Stay on the page: no dialler, no new tab.
      link?.addEventListener("click", (event) => event.preventDefault(), { once: true });
      link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
    return (window as unknown as { dataLayer: Array<{ event: string }> }).dataLayer;
  });
  expect(events.map((event) => event.event)).toEqual(["click_call", "click_whatsapp"]);
});
