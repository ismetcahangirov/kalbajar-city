import { expect, test, type Page, type Response } from "@playwright/test";

import { ensureAccount, signIn, waitForShell } from "./console";

const toggle = "Menyunu aç və ya bağla";

/** Each test signs in as an account of its own, so parallel tests never share a session. */
async function signInAs(
  page: Page,
  role: "owner" | "sales",
  test: string,
  project: string,
  baseURL: string,
) {
  const email = `e2e-shell-${test}-${project}@test.kalbajarcity.com`;
  await ensureAccount(role, email, role === "owner" ? "E2E Shell Owner" : "E2E Satış");
  await signIn(page, email, baseURL);
}

/** Presses Tab until the focused element matches, as a keyboard user would. */
async function tabTo(page: Page, name: string, limit = 40) {
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return element?.getAttribute("aria-label") ?? element?.innerText.trim() ?? "";
    });
    if (focused === name || focused.endsWith(`\n${name}`)) return;
  }
  throw new Error(`Tab never reached "${name}"`);
}

const sidebarLink = (page: Page, name: string) =>
  page.locator('[data-slot="sidebar"]').getByRole("link", { name, exact: true });

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the icon rail exists from md");

  test("the sidebar collapses to icons and expands again, by keyboard, and remembers it", async ({
    page,
    baseURL,
  }, info) => {
    await signInAs(page, "owner", "rail", info.project.name, baseURL!);
    await page.goto("/admin");
    await waitForShell(page);
    const sidebar = page.locator('[data-slot="sidebar"][data-state]');
    const container = page.locator('[data-slot="sidebar-container"]');
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    // The skip link comes first, then the sidebar, then the page.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Məzmuna keç" })).toBeFocused();

    await tabTo(page, toggle);
    await page.keyboard.press("Enter");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect.poll(async () => (await container.boundingBox())?.width).toBeLessThan(60);
    // In the rail, items keep their names and get a tooltip on focus.
    await expect(sidebarLink(page, "Mənzillər")).toBeVisible();

    await page.reload();
    await waitForShell(page);
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");

    await page.keyboard.press("Control+b");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect.poll(async () => (await container.boundingBox())?.width).toBeGreaterThan(200);

    await tabTo(page, "Mənzillər");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/menziller$/);
    await expect(sidebarLink(page, "Mənzillər")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Naviqasiya yolu" })).toContainText("İcmal");
  });

  test("public pages load none of the console's code", async ({ page }) => {
    const scripts: Promise<string>[] = [];
    const collect = (response: Response) => {
      if (response.url().endsWith(".js")) scripts.push(response.text());
    };
    page.on("response", collect);
    await page.goto("/");
    await page.waitForLoadState("load");
    // A chunk requested after load (a deferred island) would otherwise still
    // be reading its body when the test ends, which fails the test.
    page.off("response", collect);
    const bodies = await Promise.all(scripts);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toContain("sidebar_state");
      expect(body).not.toContain(toggle);
    }
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "the sheet replaces the sidebar below md");

  test("the menu opens as a sheet, closes on Escape and after navigating", async ({
    page,
    baseURL,
  }, info) => {
    await signInAs(page, "owner", "sheet", info.project.name, baseURL!);
    await page.goto("/admin");
    await waitForShell(page);
    await expect(page.getByRole("link", { name: "Mənzillər", exact: true })).toBeHidden();
    expect(await overflow(page)).toBe(0);

    const trigger = page.getByRole("button", { name: toggle });
    await tabTo(page, toggle);
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Menyu" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(sheet.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible();
    await tabTo(page, "Mənzillər");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/menziller$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mənzillər");
  });
});

test("a sales user sees only its menu items and cannot open the others", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  await signInAs(page, "sales", "menu", info.project.name, baseURL!);
  await page.goto("/admin");
  await waitForShell(page);
  // The dashboard shows the cards of the modules it may open.
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Bu həftənin müraciətləri" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Mənzillər statusa görə" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Son fəaliyyət" })).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Çatışmayan tərcümələr" })).toHaveCount(0);

  if (isMobile) await page.getByRole("button", { name: toggle }).click();

  const items = page.locator('[data-slot="sidebar-content"] [data-slot="sidebar-menu-button"]');
  await expect(items).toHaveText(["İcmal", "Mənzillər", "Müraciətlər"]);
  await expect(page.getByTestId("sidebar-user")).toContainText("Satış");

  const response = await page.goto("/admin/audit");
  expect(response?.status()).toBe(403);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Giriş icazəsi yoxdur");
});

test("every menu link opens a page", async ({ page, baseURL }, info) => {
  await signInAs(page, "owner", "links", info.project.name, baseURL!);
  for (const [path, title] of [
    ["/admin/muracietler", "Müraciətlər"],
    ["/admin/xeberler", "Xəbərlər"],
    ["/admin/media", "Media"],
    ["/admin/ayarlar", "Ayarlar"],
    ["/admin/istifadeciler", "İstifadəçilər"],
    ["/admin/audit", "Audit jurnalı"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    expect(await overflow(page), path).toBe(0);
  }
});

test("the apartments table paginates and filters through the URL and survives a reload", async ({
  page,
  baseURL,
  isMobile,
}, info) => {
  await signInAs(page, "owner", "table", info.project.name, baseURL!);
  await page.goto("/admin/menziller");
  await waitForShell(page);
  const results = page.getByRole("status").filter({ hasText: /\d+ nəticə/ });
  await expect(results).toBeVisible();
  expect(await overflow(page)).toBe(0);

  // Rows are a table from md and cards below it; read whichever is shown.
  const list = isMobile
    ? page.getByRole("list", { name: "Mənzillərin siyahısı" })
    : page.getByRole("table");
  const firstRow = await list.innerText();

  await page.getByRole("button", { name: "Növbəti" }).click();
  await expect(page).toHaveURL(/[?&]sehife=2(&|$)/);
  await expect(page.getByText(/^Səhifə 2 \/ \d+$/)).toBeVisible();
  await expect.poll(() => list.innerText()).not.toBe(firstRow);

  await page.getByRole("button", { name: /^Status/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Satılıb" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\?status=sold$/);

  const onlySold = async () => {
    const text = await list.innerText();
    return text.includes("Satılıb") && !/Satışda|Rezerv/.test(text);
  };
  await expect.poll(onlySold).toBe(true);

  await page.reload();
  await waitForShell(page);
  await expect(page).toHaveURL(/\?status=sold$/);
  await expect(page.getByRole("button", { name: /^Status/ })).toContainText("1");
  await expect.poll(onlySold).toBe(true);

  await page.getByRole("button", { name: "Filtrləri təmizlə" }).first().click();
  await expect(page).toHaveURL(/\/admin\/menziller$/);
});
