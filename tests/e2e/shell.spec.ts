import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { leads } from "@/db/schema";
import az from "@/i18n/messages/az.json";

import { waitForHydration } from "./hydration";

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const focusInside = (page: Page, selector: string) =>
  page.evaluate((s) => document.activeElement?.closest(s) !== null, selector);

/** Opens the menu from the visible burger and returns the dialog. */
async function openMenu(page: Page) {
  const burger = page.getByRole("banner").getByRole("button", { name: az.Shell.openMenu });
  await burger.click();
  const menu = page.getByRole("dialog", { name: az.Shell.menu });
  await expect(menu).toBeVisible();
  return { burger, menu };
}

test.describe("header", () => {
  test("offers the catalogue, the call, the inquiry and the languages", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/haqqimizda");
    const header = page.getByRole("banner");
    // An icon on phones, the number itself from xl.
    await expect(header.locator('a[href="tel:+994124343232"]:visible')).toHaveCount(1);
    if (isMobile) return;
    await expect(header.getByRole("link", { name: az.Shell.chooseApartment })).toHaveAttribute(
      "href",
      "/menziller",
    );
    await expect(header.getByRole("link", { name: az.Shell.inquire })).toBeVisible();
    await expect(header.getByRole("navigation", { name: az.LocaleSwitcher.label })).toBeVisible();
  });

  test("collapses into the frosted bar once the page scrolls, and back at the top", async ({
    page,
  }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    const header = page.locator("[data-site-header]");
    await expect(header).not.toHaveAttribute("data-collapsed");
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).toHaveAttribute("data-collapsed", "");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).not.toHaveAttribute("data-collapsed");
  });

  test("takes the theme of the section under it", async ({ page }) => {
    // The page is light; the next-chapter teaser above the footer is dark.
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    const header = page.locator("[data-site-header]");
    await expect(header).toHaveAttribute("data-theme", "light");
    // Past the scroll padding that keeps targets clear of the header.
    await page
      .getByRole("complementary", { name: az.Shell.next })
      .evaluate((teaser) => window.scrollBy(0, teaser.getBoundingClientRect().top + 100));
    await expect(header).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("menu", () => {
  test("traps focus, closes on Escape and returns focus to the burger", async ({ page }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    const { burger, menu } = await openMenu(page);
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("button", { name: az.Shell.closeMenu })).toBeFocused();

    // More presses than the menu has stops, both ways: focus never leaves it.
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 30; i += 1) {
        await page.keyboard.press(key);
        expect(await focusInside(page, "#site-menu")).toBe(true);
      }
    }

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(burger).toBeFocused();
    await expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  test("closes with its close button and on the backdrop", async ({ page, isMobile }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    let { menu } = await openMenu(page);
    await menu.getByRole("button", { name: az.Shell.closeMenu }).click();
    await expect(menu).toBeHidden();

    test.skip(isMobile, "the mobile menu fills the screen: it has no backdrop");
    ({ menu } = await openMenu(page));
    // Below the 540 px panel.
    await page.mouse.click(720, 800);
    await expect(menu).toBeHidden();
  });

  test("lists every chapter, marks the current one and closes on navigation", async ({ page }) => {
    await page.goto("/en/haqqimizda");
    await waitForHydration(page);
    await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    const nav = menu.getByRole("navigation", { name: "Main menu" });
    await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Gallery" })).not.toHaveAttribute("aria-current");

    await nav.getByRole("link", { name: "Gallery" }).click();
    await expect(page).toHaveURL(/\/en\/qalereya$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gallery");
    await expect(menu).toBeHidden();
  });

  test("keeps the call, WhatsApp and the languages within reach", async ({ page }) => {
    await page.goto("/ru/haqqimizda");
    await waitForHydration(page);
    await page.getByRole("banner").getByRole("button", { name: "Открыть меню" }).click();
    const menu = page.getByRole("dialog", { name: "Меню" });
    await expect(menu.getByRole("link", { name: "+994 12 434 32 32" })).toHaveAttribute(
      "href",
      "tel:+994124343232",
    );
    await expect(menu.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/994505535555\?text=/,
    );
    await expect(
      menu.getByRole("navigation", { name: "Язык" }).getByRole("link", { name: "English" }),
    ).toHaveAttribute("href", "/en/haqqimizda");
  });
});

test.describe("inquiry dialog", () => {
  /** Opens it the way a visitor would: the header link from lg, the menu below. */
  async function openInquiry(page: Page, isMobile: boolean) {
    if (isMobile) {
      const { menu } = await openMenu(page);
      await menu.getByRole("link", { name: az.Shell.inquire }).click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: az.Shell.inquire }).click();
    }
    const dialog = page.getByRole("dialog", { name: az.Shell.inquire });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("opens in place, reports invalid fields at once and returns focus on Escape", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    const dialog = await openInquiry(page, isMobile);
    // It opened over the page instead of following the link to /elaqe.
    await expect(page).toHaveURL(/\/haqqimizda$/);
    await expect(dialog.getByRole("button", { name: az.Shell.closeInquiry })).toBeFocused();

    // The deferred form arrives; sending it empty reports every field.
    await dialog.getByRole("button", { name: az.LeadForm.submit.inquiry }).click();
    await expect(dialog.getByRole("status")).toContainText("3 xana");
    await expect(dialog.getByLabel(az.LeadForm.name)).toBeFocused();
    await expect(dialog.getByLabel(az.LeadForm.name)).toHaveAttribute("aria-invalid", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    if (!isMobile) {
      await expect(
        page.getByRole("banner").getByRole("link", { name: az.Shell.inquire }),
      ).toBeFocused();
    }
  });

  test("sends an inquiry with the page it was sent from", async ({ page, isMobile }, testInfo) => {
    const name = `E2E shell ${testInfo.project.name}-${randomUUID().slice(0, 8)}`;
    const octet = Math.floor(Math.random() * 250) + 1;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${octet}.${octet}` });
    await page.goto("/yerlesme");
    await waitForHydration(page);
    const dialog = await openInquiry(page, isMobile);
    await dialog.getByLabel(az.LeadForm.name).fill(name);
    const shown = Date.now();
    await dialog.getByLabel(az.LeadForm.phone).fill("050 123 45 67");
    await dialog.getByRole("checkbox").check();
    // The form's time trap drops anything sent within three seconds.
    await page.waitForTimeout(Math.max(0, 3500 - (Date.now() - shown)));
    await dialog.getByRole("button", { name: az.LeadForm.submit.inquiry }).click();
    await expect(dialog.getByText(az.LeadForm.success.title)).toBeFocused();

    const { db, close } = connect(databaseUrl());
    try {
      const [row] = await db.select().from(leads).where(eq(leads.name, name));
      expect(row).toMatchObject({ type: "inquiry", sourcePath: "/yerlesme" });
      await db.delete(leads).where(eq(leads.name, name));
    } finally {
      await close();
    }
  });

  test("opens from any element marked for it, without script falling back to /elaqe", async ({
    page,
  }) => {
    await page.goto("/haqqimizda");
    const triggers = page.locator('[data-dialog-open="inquiry"]');
    expect(await triggers.count()).toBeGreaterThan(0);
    for (const href of await triggers.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    )) {
      expect(href).toBe("/elaqe");
    }
  });
});

test.describe("page transition", () => {
  test("plays the curtain between pages and moves focus to the new heading", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the curtain is desktop only");
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    const curtain = page.locator("[data-page-curtain]");
    await page.getByRole("banner").getByRole("link", { name: az.Shell.chooseApartment }).click();
    await expect(curtain).toHaveAttribute("data-state", /in|hold|out/);
    await expect(page).toHaveURL(/\/menziller$/);
    await expect(curtain).not.toHaveAttribute("data-state");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  });

  test.describe("under reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("navigates at once, with no curtain", async ({ page, isMobile }) => {
      test.skip(isMobile, "touch never shows the curtain anyway");
      await page.goto("/haqqimizda");
      await waitForHydration(page);
      const curtain = page.locator("[data-page-curtain]");
      // Any state the curtain takes during the navigation is recorded.
      await curtain.evaluate((element) => {
        new MutationObserver(() => {
          if (element.hasAttribute("data-state")) element.setAttribute("data-played", "");
        }).observe(element, { attributes: true });
      });
      await page.getByRole("banner").getByRole("link", { name: az.Shell.chooseApartment }).click();
      await expect(page).toHaveURL(/\/menziller$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await expect(curtain).not.toHaveAttribute("data-played");
      await expect(curtain).toBeHidden();
    });
  });

  test("leaves back and forward to the browser", async ({ page, isMobile }) => {
    test.skip(isMobile, "the curtain is desktop only");
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    await page.getByRole("banner").getByRole("link", { name: az.Shell.chooseApartment }).click();
    await expect(page).toHaveURL(/\/menziller$/);
    const curtain = page.locator("[data-page-curtain]");
    await expect(curtain).not.toHaveAttribute("data-state");
    await page.goBack();
    await expect(page).toHaveURL(/\/haqqimizda$/);
    await expect(curtain).not.toHaveAttribute("data-state");
  });
});

test.describe("language switcher", () => {
  test("links the same page in every language and marks the current one", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/en/haqqimizda");
    await waitForHydration(page);
    const scope = isMobile
      ? (await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click(),
        page.getByRole("dialog", { name: "Menu" }))
      : page.getByRole("banner");
    const languages = scope.getByRole("navigation", { name: "Language" });
    await expect(languages.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(languages.getByRole("link", { name: "Azərbaycanca" })).toHaveAttribute(
      "href",
      "/haqqimizda",
    );
    const russian = languages.getByRole("link", { name: "Русский" });
    await expect(russian).toHaveAttribute("href", "/ru/haqqimizda");
    await russian.click();
    await expect(page).toHaveURL(/\/ru\/haqqimizda$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });
});

test.describe("preloader", () => {
  // The suite skips the preloader with a cookie (playwright.config.ts).
  test.use({ storageState: { cookies: [], origins: [] } });

  test("covers the first visit to the home page, then hands off", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-preloader", "on");
    await expect(page.getByRole("region", { name: az.Shell.loading })).toBeVisible();
    await expect(html).toHaveAttribute("data-preloader", "done", { timeout: 10_000 });
    await expect(page.getByRole("region", { name: az.Shell.loading })).toBeHidden();

    // Not again in the same session.
    await page.reload();
    await expect(html).not.toHaveAttribute("data-preloader");
  });

  test.describe("under reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("never shows", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).not.toHaveAttribute("data-preloader");
      await expect(page.getByRole("region", { name: az.Shell.loading })).toBeHidden();
    });
  });
});

test.describe("footer", () => {
  test("lists every page, the contacts and the privacy notice", async ({ page }) => {
    await page.goto("/ru");
    const footer = page.getByRole("contentinfo");
    const sitemap = footer.getByRole("navigation", { name: "Карта сайта" });
    await expect(sitemap.getByRole("link")).toHaveCount(8);
    await expect(footer.getByRole("link", { name: "+994 12 434 32 32" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/kalbajar.city/",
    );
    await expect(footer.getByRole("link", { name: "Политика конфиденциальности" })).toHaveAttribute(
      "href",
      "/ru/mexfilik-siyaseti",
    );
    await expect(footer.getByRole("link", { name: "Наверх" })).toHaveAttribute("href", "#main");
  });

  test("teases the next chapter, and the last chapter has none", async ({ page }) => {
    await page.goto("/kompleks");
    const teaser = page.getByRole("complementary", { name: az.Shell.next });
    await expect(teaser.getByRole("link")).toHaveAccessibleName(
      `${az.Shell.next}: ${az.Navigation.about}`,
    );
    await expect(teaser.getByRole("link")).toHaveAttribute("href", "/haqqimizda");

    await page.goto("/elaqe");
    await expect(page.getByRole("complementary", { name: az.Shell.next })).toHaveCount(0);
  });
});

test.describe("in a Russian browser", () => {
  test.use({ locale: "ru-RU", extraHTTPHeaders: { "Accept-Language": "ru-RU,ru;q=0.9" } });

  test("the fixed WhatsApp button lifts above the locale suggestion", async ({ page }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    const banner = page.locator("[data-locale-suggestion]");
    await expect(banner).toBeVisible();
    const button = page.locator("[data-fixed-buttons]");
    await expect
      .poll(async () => {
        const [b, f] = [await banner.boundingBox(), await button.boundingBox()];
        return !!b && !!f && f.y + f.height <= b.y + 0.5;
      })
      .toBe(true);
  });
});

test("the skip link is the first stop and moves focus to the content", async ({ page }) => {
  await page.goto("/menziller");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: az.Shell.skip });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

for (const path of ["/", "/en/menziller", "/ru/haqqimizda"]) {
  for (const width of [320, 1920]) {
    test(`${path} has no horizontal scroll at ${width} px, menu open or not`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await waitForHydration(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await overflow(page)).toBe(0);

      await page.getByRole("banner").getByRole("button").first().click();
      const menu = page.locator("#site-menu");
      await expect(menu).toBeVisible();
      const fits = await menu.evaluate((dialog) =>
        [...dialog.querySelectorAll<HTMLElement>("a, button")]
          .filter((element) => element.offsetParent !== null)
          .every((element) => element.getBoundingClientRect().right <= window.innerWidth + 0.5),
      );
      expect(fits).toBe(true);
    });
  }
}
