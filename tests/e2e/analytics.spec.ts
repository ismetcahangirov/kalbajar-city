import { devices, expect, test, type Page } from "@playwright/test";

import { omit } from "@/lib/omit";
import type { AdminSetting, SettingsValue } from "@/shared/settings";

import { ensureAccount, signIn } from "./console";

/*
 * GA4 and the Meta Pixel stay out of the LCP critical path (#29). Saving IDs
 * changes every public page, and other specs read `window.dataLayer` or
 * expect no analytics, so this file runs in its own Playwright project
 * after the others have finished (playwright.config.ts), one test at a time.
 */
test.describe.configure({ mode: "serial" });

const ids: SettingsValue<"analytics"> = {
  googleAnalyticsId: "G-E2ETEST01",
  metaPixelId: "1234567890",
};
const thirdParty = /^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\//;
const owner = "e2e-analytics-owner@test.kalbajarcity.com";

let original: SettingsValue<"analytics"> | null = null;

async function asOwner(page: Page, baseURL: string) {
  await ensureAccount("owner", owner, "E2E Analytics Owner");
  await signIn(page, owner, baseURL);
}

async function writeAnalytics(page: Page, value: SettingsValue<"analytics">) {
  const response = await page.request.put("/api/v1/admin/settings/analytics", { data: value });
  expect(response.status()).toBe(200);
}

test.beforeAll(async ({ browser, baseURL }) => {
  const page = await browser.newPage({ baseURL });
  await asOwner(page, baseURL!);
  const current = await page.request.get("/api/v1/admin/settings/analytics");
  expect(current.status()).toBe(200);
  original = ((await current.json()) as AdminSetting<"analytics">).value;
  await writeAnalytics(page, ids);
  await page.close();
});

test.afterAll(async ({ browser, baseURL }) => {
  if (!original) return;
  const page = await browser.newPage({ baseURL });
  await asOwner(page, baseURL!);
  await writeAnalytics(page, original);
  await page.close();
});

/** What the page measured: when the analytics scripts started loading, against load and LCP. */
type Timings = {
  loadEventEnd: number;
  /** The last LCP candidate's time; null if the browser reported none. */
  lcp: number | null;
  scripts: Array<{ name: string; startTime: number }>;
  gtag: boolean;
  fbq: boolean;
};

async function timings(page: Page): Promise<Timings> {
  return page.evaluate(async (pattern) => {
    const lcp = await new Promise<number | null>((resolve) => {
      new PerformanceObserver((list) =>
        resolve(list.getEntries().at(-1)?.startTime ?? null),
      ).observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => resolve(null), 1000);
    });
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    const w = window as unknown as { gtag?: unknown; fbq?: unknown };
    return {
      loadEventEnd: navigation!.loadEventEnd,
      lcp,
      scripts: performance
        .getEntriesByType("resource")
        .filter((entry) => new RegExp(pattern).test(entry.name))
        .map((entry) => ({ name: entry.name, startTime: entry.startTime })),
      gtag: typeof w.gtag === "function",
      fbq: typeof w.fbq === "function",
    };
  }, thirdParty.source);
}

// A describe group may not change the browser type, so the devices go without it.
const desktop = omit(devices["Desktop Chrome"], ["defaultBrowserType"]);
const mobile = omit(devices["Pixel 7"], ["defaultBrowserType"]);

for (const [name, device] of [
  ["desktop", { ...desktop, viewport: { width: 1440, height: 900 } }],
  ["mobile", mobile],
] as const) {
  test.describe(name, () => {
    test.use(device);

    test("GA4 and the Pixel load only after the page has loaded and painted its LCP", async ({
      page,
    }) => {
      // The first HTML neither loads nor preloads them: they cannot delay the LCP image.
      const html = await (await page.request.get("/")).text();
      expect(html).not.toMatch(/<script[^>]+src="https:\/\/www\.googletagmanager\.com/);
      expect(html).not.toMatch(/<script[^>]+src="https:\/\/connect\.facebook\.net/);
      expect(html).not.toMatch(/<link[^>]+(googletagmanager|connect\.facebook)/);

      // Stubbed, so the test needs no network and sends no hits.
      await page.route(thirdParty, (route) =>
        route.fulfill({ contentType: "text/javascript", body: "" }),
      );
      const requested: string[] = [];
      page.on("request", (request) => {
        if (thirdParty.test(request.url())) requested.push(request.url());
      });

      await page.goto("/");
      await expect.poll(() => requested.length).toBe(2);
      expect(requested.some((url) => url.includes(`gtag/js?id=${ids.googleAnalyticsId}`))).toBe(
        true,
      );
      expect(requested.some((url) => url.includes("fbevents.js"))).toBe(true);

      const measured = await timings(page);
      expect(measured.gtag && measured.fbq).toBe(true);
      expect(measured.loadEventEnd).toBeGreaterThan(0);
      expect(measured.scripts).toHaveLength(2);
      expect(measured.lcp).not.toBeNull();
      for (const script of measured.scripts) {
        expect(script.startTime, script.name).toBeGreaterThanOrEqual(measured.loadEventEnd);
        expect(script.startTime, script.name).toBeGreaterThan(measured.lcp!);
      }
    });
  });
}
