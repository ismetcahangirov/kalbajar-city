import { expect, test, type Page } from "@playwright/test";

import { connect, databaseUrl } from "@/db/client";
import { setOwner } from "@/lib/auth/owner";

import { waitForShell } from "./console";

const password = "an e2e passphrase that is long";

// One worker per project runs this file, so beforeAll creates each owner once.
test.describe.configure({ mode: "serial" });

/** One owner per project, so desktop and mobile never share a session or a lock. */
const emailFor = (project: string) => `e2e-${project}@test.kalbajarcity.com`;

test.beforeAll(async ({}, info) => {
  const { db, close } = connect(databaseUrl());
  try {
    await setOwner(db, { email: emailFor(info.project.name), name: "E2E Owner", password });
  } finally {
    await close();
  }
});

// Better Auth limits sign-ins per client IP; each test is its own client, so
// reruns and retries within a minute do not trip the limit.
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${octet()}` });
});

/** The sign-in form only works once React has attached its submit handler. */
async function waitForForm(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form !== null && Object.keys(form).some((key) => key.startsWith("__react"));
  });
}

test("a signed-out visitor is sent from the console to the sign-in page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/giris$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giriş");

  const api = await page.request.get("/api/v1/admin/me");
  expect(api.status()).toBe(401);
  expect(await api.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
  });
});

test("an owner signs in, sees the console and signs out", async ({ page, isMobile }, info) => {
  const email = emailFor(info.project.name);
  await page.goto("/admin/giris");
  await waitForForm(page);

  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page.getByText("Bu xananı doldurun.").first()).toBeVisible();

  await page.getByLabel("E-poçt").fill(email);
  await page.getByLabel("Şifrə", { exact: true }).fill("not the right password");
  await page.getByRole("button", { name: "Daxil ol" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "E-poçt və ya şifrə yanlışdır.",
  );
  await expect(page).toHaveURL(/\/admin\/giris$/);

  await page.getByLabel("Şifrə", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Şifrəni göstər" }).click();
  await expect(page.getByLabel("Şifrə", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Daxil ol" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("İcmal");
  await expect(page.getByText("Xoş gəldiniz, E2E Owner.")).toBeVisible();
  expect((await page.request.get("/api/v1/admin/me")).status()).toBe(200);

  // A signed-in visitor skips the sign-in page.
  await page.goto("/admin/giris");
  await expect(page).toHaveURL(/\/admin$/);

  // The sign-out button is in the sidebar, a sheet behind the menu button on phones.
  await waitForShell(page);
  if (isMobile) await page.getByRole("button", { name: "Menyunu aç və ya bağla" }).click();
  await expect(page.getByTestId("sidebar-user")).toContainText("Sahib");
  await page.getByRole("button", { name: "Çıxış" }).click();
  await expect(page).toHaveURL(/\/admin\/giris$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/giris$/);
});

test("an expired reset link says so and offers a new one", async ({ page }) => {
  await page.goto("/admin/sifre-berpa?error=INVALID_TOKEN");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Şifrənin bərpası");
  await expect(page.getByRole("main").getByRole("alert").first()).toHaveText(
    "Link etibarsızdır və ya vaxtı keçib. Yeni link istəyin.",
  );
  await expect(page.getByRole("button", { name: "Link göndər" })).toBeVisible();
});

test("every page carries the security headers and runs under its CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  for (const path of ["/", "/en/menziller", "/admin/giris"]) {
    const response = await page.goto(path);
    const headers = response?.headers() ?? {};
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"], path).toContain("object-src 'none'");
    expect(headers["strict-transport-security"], path).toContain("max-age=63072000");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"], path).toBe("DENY");
  }
  expect(violations).toEqual([]);
});
