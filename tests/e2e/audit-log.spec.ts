import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { auditLog, users } from "@/db/schema";

import { ensureAccount, signIn, waitForShell } from "./console";

const secret = "tok-SECRET-e2e-1234";

async function withDb<T>(fn: (db: ReturnType<typeof connect>["db"]) => Promise<T>): Promise<T> {
  const { db, close } = connect(databaseUrl());
  try {
    return await fn(db);
  } finally {
    await close();
  }
}

async function signInAs(page: Page, role: "owner" | "sales", key: string, baseURL: string) {
  const email = `e2e-audit-${key}@test.kalbajarcity.com`;
  await ensureAccount(role, email, `E2E Audit ${key}`);
  await signIn(page, email, baseURL);
  return withDb(async (db) => {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return row!.id;
  });
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("an owner reads an entry: the diff, Baku time, and no secret reaches the browser", async ({
  page,
  baseURL,
}, info) => {
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const entityId = `e2e-audit-${tag}`;
  const actorId = await signInAs(page, "owner", info.project.name, baseURL!);
  const hash = await hashPassword("a passphrase that is long");
  const longValue = "bir-çox-uzun-dəyər-".repeat(30);

  await withDb((db) =>
    db.insert(auditLog).values({
      actorId,
      action: "apartment.update",
      entityType: "apartment",
      entityId,
      before: {
        status: "available",
        passwordHash: hash,
        session: { token: secret },
        description: longValue,
      },
      after: { status: "sold", passwordHash: "new", link: `https://x.test/?token=${secret}` },
      ip: "203.0.113.5",
      userAgent: "E2E browser",
      // 00:30 on 3 November in Baku, still 2 November in UTC.
      createdAt: new Date("2026-11-02T20:30:00Z"),
    }),
  );

  try {
    const answer = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/admin/audit?") && response.url().includes(entityId),
    );
    await page.goto(`/admin/audit?obyekt-id=${entityId}`);
    await waitForShell(page);
    const body = await (await answer).text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain(hash);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit jurnalı");
    await expect(page.getByRole("status").filter({ hasText: /\d+ nəticə/ })).toHaveText("1 nəticə");
    const entries =
      info.project.name === "mobile" ? page.getByRole("listitem") : page.getByRole("row");
    const entry = entries.filter({ hasText: "Mənzili yenilədi" });
    await expect(entry).toContainText("03.11.2026, 00:30");
    await expect(entry).toContainText("E2E Audit");
    await expect(entry).toContainText(entityId);
    // jsonb keeps keys shortest first, so that is the order the log holds.
    await expect(entry).toContainText("status, session, description və daha 2");
    expect(await overflow(page)).toBe(0);

    const open = entry.getByRole("button", { name: /^Bax/ });
    if (info.project.name === "mobile") {
      expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    } else {
      // Every width the console supports, the table's narrow end included.
      for (const width of [320, 768, 1024, 1920, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await overflow(page), `${width} px`).toBe(0);
      }
    }

    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toContainText(["Mənzili yenilədi"]);
    await expect(dialog).toContainText("03.11.2026, 00:30");
    await expect(dialog).toContainText("203.0.113.5");
    await expect(dialog).toContainText("E2E browser");

    const field = (name: string) =>
      dialog.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
    await expect(field("status")).toContainText("Əvvəl");
    await expect(field("status")).toContainText("available");
    await expect(field("status")).toContainText("Sonra");
    await expect(field("status")).toContainText("sold");
    // Hidden on both sides, and still shown as changed.
    await expect(field("passwordHash").getByText("[gizlədilib]")).toHaveCount(2);
    await expect(field("session")).toContainText("[gizlədilib]");
    await expect(field("session")).toContainText("bu sahə yox idi");
    await expect(field("link")).toContainText("token=[gizlədilib]");

    expect(await page.content()).not.toContain(secret);
    await expect(dialog).not.toContainText(hash);

    const fits = await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth);
    expect(fits, "the dialog does not scroll sideways").toBe(true);
    expect(await overflow(page)).toBe(0);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
  } finally {
    await withDb((db) => db.delete(auditLog).where(eq(auditLog.entityId, entityId)));
  }
});

test("the filters narrow the list and stay in the URL: user, entity, Baku days", async ({
  page,
  baseURL,
}, info) => {
  const tag = `${info.project.name}-${randomUUID().slice(0, 8)}`;
  const entityType = `e2e_audit_${tag.replace(/-/g, "_").toLowerCase()}`;
  const ownerId = await signInAs(page, "owner", `filters-${info.project.name}`, baseURL!);
  const ids = { mine: `${tag}-mine`, system: `${tag}-system`, other: `${tag}-other` };

  await withDb((db) =>
    db.insert(auditLog).values([
      {
        actorId: ownerId,
        action: `${entityType}.update`,
        entityType,
        entityId: ids.mine,
        createdAt: new Date("2026-10-30T20:00:00Z"), // 31 October, 00:00 in Baku
      },
      {
        actorId: null,
        action: `${entityType}.update`,
        entityType,
        entityId: ids.system,
        createdAt: new Date("2026-10-30T19:59:00Z"), // 30 October, 23:59 in Baku
      },
      {
        actorId: ownerId,
        action: "other.update",
        entityType: `${entityType}_other`,
        entityId: ids.other,
        createdAt: new Date("2026-10-31T10:00:00Z"),
      },
    ]),
  );

  const results = page.getByRole("status").filter({ hasText: /\d+ nəticə/ });

  try {
    await page.goto("/admin/audit");
    await waitForShell(page);

    await page.locator(`button[data-filter="obyekt"]:visible`).click();
    await page.getByRole("menuitemcheckbox", { name: entityType, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(new RegExp(`obyekt=${entityType}`));
    await expect(results).toHaveText("2 nəticə");

    await page.locator(`button[data-filter="istifadeci"]:visible`).click();
    await page.getByRole("menuitemcheckbox", { name: "Sistem", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/istifadeci=system/);
    await expect(results).toHaveText("1 nəticə");
    await expect(page.getByText(ids.system).locator("visible=true")).toBeVisible();

    // A reload keeps the view.
    await page.reload();
    await expect(results).toHaveText("1 nəticə");

    // The same instants, on either side of midnight in Baku.
    await page.goto(`/admin/audit?obyekt=${entityType}&tarixden=2026-10-31&tarixedek=2026-10-31`);
    await expect(results).toHaveText("1 nəticə");
    await expect(page.getByText(ids.mine).locator("visible=true")).toBeVisible();
    await page.goto(`/admin/audit?obyekt=${entityType}&tarixedek=2026-10-30`);
    await expect(results).toHaveText("1 nəticə");
    await expect(page.getByText(ids.system).locator("visible=true")).toBeVisible();

    // Nothing here writes: the viewer has no way to change an entry.
    await page.goto(`/admin/audit?obyekt-id=${ids.mine}`);
    await expect(results).toHaveText("1 nəticə");
    await expect(page.getByRole("button", { name: /Sil|Redaktə/ })).toHaveCount(0);
  } finally {
    await withDb((db) => db.delete(auditLog).where(inArray(auditLog.entityId, Object.values(ids))));
  }
});

test("without audit:read neither the screen nor the endpoint opens", async ({
  page,
  baseURL,
}, info) => {
  await signInAs(page, "sales", `sales-${info.project.name}`, baseURL!);
  const screen = await page.goto("/admin/audit");
  expect(screen?.status()).toBe(403);
  expect((await page.request.get("/api/v1/admin/audit")).status()).toBe(403);

  await page.context().clearCookies();
  expect((await page.request.get("/api/v1/admin/audit")).status()).toBe(401);
});
