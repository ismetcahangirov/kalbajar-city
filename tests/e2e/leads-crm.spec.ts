import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { and, eq, like } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { auditLog, leadEvents, leads, users } from "@/db/schema";

import { ensureAccount, signIn, waitForShell } from "./console";

// Mailpit's API (docker compose maps it to 8035; CI sets MAILPIT_URL).
const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8035";

type Role = "owner" | "sales";

/** An account of this test's own, signed in, with its user id. */
async function signInAs(page: Page, role: Role, name: string, key: string, baseURL: string) {
  const email = `e2e-crm-${key}@test.kalbajarcity.com`;
  await ensureAccount(role, email, name);
  await signIn(page, email, baseURL);
  return userId(email);
}

async function withDb<T>(fn: (db: ReturnType<typeof connect>["db"]) => Promise<T>): Promise<T> {
  const { db, close } = connect(databaseUrl());
  try {
    return await fn(db);
  } finally {
    await close();
  }
}

async function userId(email: string): Promise<string> {
  return withDb(async (db) => {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return row!.id;
  });
}

/** A lead straight in the database, as the public form would have stored it. */
async function insertLead(name: string, sourcePath: string, values: { assigneeId?: string } = {}) {
  return withDb(async (db) => {
    const [row] = await db
      .insert(leads)
      .values({
        type: "callback",
        name,
        phone: "+994501234567",
        locale: "az",
        sourcePath,
        ...values,
      })
      .returning({ id: leads.id });
    await db
      .insert(leadEvents)
      .values({ leadId: row!.id, type: "created", data: { type: "callback" } });
    return row!.id;
  });
}

const deleteLeads = (sourcePath: string) =>
  withDb((db) => db.delete(leads).where(like(leads.sourcePath, `${sourcePath}%`)));

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("a lead sent through the API appears in the open list without a reload", async ({
  page,
  request,
  baseURL,
  isMobile,
}, info) => {
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const sourcePath = `/t-e2e-${tag}`;
  const name = `E2E CRM ${tag}`;
  await signInAs(page, "owner", "E2E CRM Owner", `list-${info.project.name}`, baseURL!);
  await page.goto("/admin/muracietler");
  await waitForShell(page);
  await expect(page.getByRole("status").filter({ hasText: /\d+ nəticə/ })).toBeVisible();
  expect(await overflow(page)).toBe(0);

  try {
    const sentAt = Date.now();
    const octet = Math.floor(Math.random() * 250) + 1;
    const response = await request.post("/api/v1/leads", {
      headers: { "x-forwarded-for": `198.19.${octet}.${octet}` },
      data: {
        type: "callback",
        name,
        phone: "050 123 45 67",
        locale: "az",
        sourcePath,
        utm: { source: `e2e-${tag}` },
        consent: true,
        website: "",
        startedAt: sentAt - 20_000,
        sentAt,
      },
    });
    expect(response.status()).toBe(201);

    // The list polls every 15 seconds; no reload, no click.
    const link = page.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible({ timeout: 25_000 });
    const row = isMobile
      ? page.getByRole("listitem").filter({ has: link })
      : page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText("Yeni");
    await expect(row).toContainText(`e2e-${tag}`);

    if (!isMobile) {
      await expect(page.getByTestId("new-leads-badge")).toBeVisible();
    }

    await link.click();
    await expect(page).toHaveURL(/\/admin\/muracietler\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByTestId("lead-timeline")).toContainText("Müraciət saytdan gəldi");
  } finally {
    await deleteLeads(sourcePath);
    // The sales e-mail the lead triggered.
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
      // Mailpit is a convenience here; the lead test checks the e-mail itself.
    }
  }
});

/** Presses Tab until `target` has focus, as a keyboard user would. */
async function tabTo(page: Page, target: ReturnType<Page["locator"]>, limit = 60) {
  for (let step = 0; step < limit; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element");
}

test("the detail page works by keyboard: status, lost with a reason, a note, all on the timeline and in the audit log", async ({
  page,
  baseURL,
}, info) => {
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const sourcePath = `/t-e2e-${tag}`;
  const name = `E2E Detail ${tag}`;
  const ownerId = await signInAs(
    page,
    "owner",
    "E2E CRM Owner",
    `detail-${info.project.name}`,
    baseURL!,
  );
  const id = await insertLead(name, sourcePath);

  try {
    await page.goto(`/admin/muracietler/${id}`);
    await waitForShell(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    expect(await overflow(page)).toBe(0);

    // Call and WhatsApp: big, and on a phone fixed to the bottom of the screen.
    const bar = page.getByTestId("lead-call-bar");
    const call = bar.getByRole("link", { name: "Zəng et" });
    await expect(call).toHaveAttribute("href", "tel:+994501234567");
    const whatsapp = bar.getByRole("link", { name: /WhatsApp/ });
    const href = new URL((await whatsapp.getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe("https://wa.me/994501234567");
    expect(href.searchParams.get("text")).toMatch(/^Salam, E2E!/);
    const box = (await call.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (info.project.name === "mobile") {
      const viewport = page.viewportSize()!;
      expect(box.y + box.height).toBeGreaterThan(viewport.height - 80);
    }

    const timeline = page.getByTestId("lead-timeline");
    const status = page.getByRole("combobox", { name: "Status" });

    // new → contacted, by keyboard.
    await tabTo(page, status);
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "2. Əlaqə saxlanılıb" }).focus();
    await page.keyboard.press("Enter");
    await expect(timeline).toContainText("Status: Yeni → Əlaqə saxlanılıb");
    await expect(status).toBeFocused();

    // lost asks for a reason first; Escape keeps the status.
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "6. İtirilib" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Müraciət niyə itirildi?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(status).toContainText("Əlaqə saxlanılıb");
    await expect(status).toBeFocused();

    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "6. İtirilib" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    const reason = dialog.getByLabel("İtirilmə səbəbi");
    await expect(reason).toBeFocused();
    // Sent empty: the field says why.
    await tabTo(page, dialog.getByRole("button", { name: "İtirilmiş kimi qeyd et" }));
    await page.keyboard.press("Enter");
    await expect(reason).toHaveAttribute("aria-invalid", "true");
    await expect(reason).toBeFocused();
    await page.keyboard.type("Başqa layihədən aldı");
    await tabTo(page, dialog.getByRole("button", { name: "İtirilmiş kimi qeyd et" }));
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(timeline).toContainText(
      "Status: Əlaqə saxlanılıb → İtirilib: Başqa layihədən aldı",
    );

    // A note.
    const note = page.getByLabel("Yeni qeyd");
    await tabTo(page, note);
    await page.keyboard.type(`Zəng etdim ${tag}`);
    await tabTo(page, page.getByRole("button", { name: "Qeydi əlavə et" }));
    await page.keyboard.press("Enter");
    await expect(timeline.getByRole("listitem").first()).toContainText(`Zəng etdim ${tag}`);
    await expect(note).toHaveValue("");

    // Newest first, and every change in the audit log.
    await expect(timeline.getByRole("listitem")).toHaveCount(4);
    const actions = await withDb((db) =>
      db
        .select({ action: auditLog.action, actorId: auditLog.actorId })
        .from(auditLog)
        .where(and(eq(auditLog.entityType, "lead"), eq(auditLog.entityId, id))),
    );
    expect(actions.map((entry) => entry.action).sort()).toEqual([
      "lead.note_add",
      "lead.update",
      "lead.update",
    ]);
    expect(actions.every((entry) => entry.actorId === ownerId)).toBe(true);
  } finally {
    await deleteLeads(sourcePath);
  }
});

test("sales sees only its own and unassigned leads, and cannot export", async ({
  page,
  baseURL,
}, info) => {
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const sourcePath = `/t-e2e-${tag}`;
  const colleagueEmail = `e2e-crm-colleague-${info.project.name}@test.kalbajarcity.com`;
  await ensureAccount("sales", colleagueEmail, "E2E Colleague");
  const colleague = await userId(colleagueEmail);
  const me = await signInAs(page, "sales", "E2E CRM Sales", `scope-${info.project.name}`, baseURL!);

  const names = { free: `Free ${tag}`, mine: `Mine ${tag}`, theirs: `Theirs ${tag}` };
  await insertLead(names.free, sourcePath);
  await insertLead(names.mine, sourcePath, { assigneeId: me });
  const theirs = await insertLead(names.theirs, sourcePath, { assigneeId: colleague });

  try {
    await page.goto(`/admin/muracietler?menbe=${encodeURIComponent(sourcePath)}`);
    await waitForShell(page);
    await expect(page.getByRole("status").filter({ hasText: /^2 nəticə$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: names.free, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: names.mine, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: names.theirs, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "CSV ixrac et" })).toHaveCount(0);

    const exported = await page.request.get("/api/v1/admin/leads/export.csv");
    expect(exported.status()).toBe(403);
    const opened = await page.goto(`/admin/muracietler/${theirs}`);
    expect(opened?.status()).toBe(403);
    const api = await page.request.get(`/api/v1/admin/leads/${theirs}`);
    expect(api.status()).toBe(403);
  } finally {
    await deleteLeads(sourcePath);
  }
});
