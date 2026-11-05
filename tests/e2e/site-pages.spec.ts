import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { connect, databaseUrl } from "@/db/client";
import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";
import { setOwner } from "@/lib/auth/owner";

import { waitForHydration } from "./hydration";
import { flaggedPaths, patchContacts, readContacts, restoreFlags } from "./settings";

const catalogues = { az, en, ru };
const prefix = { az: "", en: "/en", ru: "/ru" };

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * next-intl renders a missing message as its key path ("Location.lead"), so a
 * namespace name followed by a dot and a key in the page text is a gap.
 */
async function expectNoMissingMessages(page: Page) {
  const namespaces = Object.keys(az).join("|");
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(new RegExp(`\\b(${namespaces})\\.[A-Za-z]`));
}

test.describe("the about, location, contact, privacy and 404 pages", () => {
  test.skip(({ isMobile }) => isMobile, "one viewport is set explicitly");

  for (const locale of ["az", "en", "ru"] as const) {
    const nav = catalogues[locale].Navigation;
    const pages = [
      { path: "/haqqimizda", heading: nav.about, status: 200 },
      { path: "/yerlesme", heading: nav.location, status: 200 },
      { path: "/elaqe", heading: nav.contact, status: 200 },
      { path: "/mexfilik-siyaseti", heading: nav.privacy, status: 200 },
      { path: "/yoxdur", heading: catalogues[locale].NotFound.title, status: 404 },
    ];
    for (const { path, heading, status } of pages) {
      test(`${prefix[locale]}${path} renders in ${locale}, complete, at 320 px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: 320, height: 720 });
        const response = await page.goto(`${prefix[locale]}${path}`);
        expect(response?.status()).toBe(status);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
        await expectNoMissingMessages(page);
        await expectNoHorizontalScroll(page);
      });
    }
  }

  test("the about page states the facts as sentences", async ({ page }) => {
    await page.goto("/en/haqqimizda");
    const facts = page.getByRole("region", { name: "Kalbajar City in brief" });
    await expect(facts.getByRole("listitem")).toContainText([
      "Kalbajar City is a residential complex in Kalbajar, Azerbaijan, developed by InCity Projects.",
      "Kalbajar City has 143 apartments in 6 residential buildings with 9 blocks.",
    ]);
  });

  test("the 404 links back to the catalogue and home", async ({ page }) => {
    await page.goto("/ru/yoxdur");
    await expect(page.getByRole("link", { name: ru.NotFound.catalogue })).toHaveAttribute(
      "href",
      "/ru/menziller",
    );
    await expect(page.getByRole("link", { name: ru.NotFound.home })).toHaveAttribute("href", "/ru");
  });
});

test("every phone on /elaqe is a tel: link and WhatsApp opens with a message", async ({ page }) => {
  await page.goto("/elaqe");
  const main = page.getByRole("main");
  const phones = main.getByRole("link", { name: /\+994/ });
  expect(await phones.count()).toBeGreaterThan(0);
  for (const href of await phones.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  )) {
    expect(href).toMatch(/^tel:\+994\d{9}$/);
  }

  // The page's own link, and the shell's (footer, action bar), all type the message in.
  const whatsapp = page.locator('a[href^="https://wa.me/"]');
  expect(await whatsapp.count()).toBeGreaterThan(1);
  for (const href of await whatsapp.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")!),
  )) {
    expect(new URL(href).searchParams.get("text")).toBe(az.Shell.whatsappMessage);
  }
});

// Coordinates are set through the console's endpoint and restored after, so
// this runs once, on desktop, in one worker (as api.spec.ts).
test.describe("the map on /yerlesme", () => {
  test.skip(({ isMobile }) => isMobile, "changes shared settings");
  test.describe.configure({ mode: "serial" });

  const email = "e2e-site-pages@test.kalbajarcity.com";
  const password = "an e2e site pages passphrase";
  const coordinates = { lat: 40.1017, lng: 46.0381 };

  async function signIn(request: APIRequestContext, baseURL: string) {
    const octet = Math.floor(Math.random() * 250) + 1;
    const response = await request.post("/api/v1/auth/sign-in/email", {
      headers: { origin: baseURL, "x-forwarded-for": `198.51.100.${octet}` },
      data: { email, password },
    });
    expect(response.status()).toBe(200);
  }

  test("loads nothing third-party until the visitor asks for the map", async ({
    page,
    baseURL,
  }) => {
    const { db, close } = connect(databaseUrl());
    try {
      await setOwner(db, { email, name: "E2E Site Pages Owner", password });
    } finally {
      await close();
    }
    await signIn(page.request, baseURL!);
    // The seed's stand-in coordinates (#27) may be flagged; a save clears the flag.
    const original = (await readContacts(page.request)).coordinates;
    const flagged = (await flaggedPaths()).filter((path) => path === "contacts.coordinates");

    try {
      await patchContacts(page.request, { coordinates });

      // Only the site itself and the object store may be asked for anything.
      const own = new Set([new URL(baseURL!).origin]);
      if (process.env.S3_PUBLIC_URL) own.add(new URL(process.env.S3_PUBLIC_URL).origin);
      const foreign: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (/^https?:$/.test(url.protocol) && !own.has(url.origin)) foreign.push(url.href);
      });

      await page.goto("/yerlesme");
      await waitForHydration(page);
      const show = page.getByRole("button", { name: az.Map.show });
      await show.scrollIntoViewIfNeeded();
      await expect(show).toBeVisible();
      await expect(page.locator("iframe")).toHaveCount(0);
      // Links to the map apps are plain links: nothing loads until one is followed.
      await expect(page.getByRole("link", { name: /Google Maps/ })).toHaveAttribute(
        "href",
        /query=40\.1017%2C46\.0381/,
      );
      await page.waitForTimeout(1000);
      expect(foreign).toEqual([]);

      const osm = page.waitForRequest((request) =>
        request.url().startsWith("https://www.openstreetmap.org/export/embed.html"),
      );
      await show.click();
      const frame = page.locator(`iframe[title="${az.Map.frameTitle}"]`);
      await expect(frame).toBeVisible();
      await expect(frame).toHaveAttribute("src", /marker=40\.1017%2C46\.0381/);
      await expect(frame).toBeFocused();
      await osm;

      // No coordinates, no map.
      await patchContacts(page.request, { coordinates: null });
      await page.goto("/yerlesme");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: az.Map.show })).toHaveCount(0);
    } finally {
      await patchContacts(page.request, { coordinates: original });
      await restoreFlags(page.request, flagged);
    }
  });
});
