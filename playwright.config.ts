import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// The server reads DATABASE_URL; pages such as home render from the database.
if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env.E2E_PORT ?? 3011);
const baseURL = `http://localhost:${port}`;

/** Where the E2E server sends lead e-mails; tests/e2e/leads.spec.ts reads them from Mailpit. */
const leadsInbox = "sales@e2e.kalbajarcity.test";

/** The E2E server's cron secret; tests/e2e/news-editor.spec.ts triggers scheduled publishing with it. */
const cronSecret = "e2e-cron-secret";

/** Specs that change site-wide values; see the `exclusive` project. */
const exclusive = /\.exclusive\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // An Azerbaijani browser by default, so the locale suggestion stays hidden
  // unless a test asks for another language.
  // The home preloader is skipped with a test cookie (src/lib/shell/preloader.ts),
  // so tests start on the page; tests/e2e/shell.spec.ts clears it to test it.
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "az-AZ",
    storageState: {
      cookies: [
        {
          name: "kc-skip-preloader",
          value: "1",
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  projects: [
    {
      name: "desktop",
      testIgnore: exclusive,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", testIgnore: exclusive, use: { ...devices["Pixel 7"] } },
    // Tests that change what every page loads or shows (the analytics IDs,
    // the main phone in the header) or
    // that read site-wide values other specs change for a moment run alone,
    // after the rest, one at a time.
    {
      name: "exclusive",
      testMatch: exclusive,
      dependencies: ["desktop", "mobile"],
      fullyParallel: false,
      workers: 1,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Runs the production build, not the dev server, so tests see what users get.
  webServer: {
    command: "pnpm start",
    url: `${baseURL}/api/health`,
    // ENABLE_PRIMITIVES serves the /primitivler fixture, which is a 404 in real production.
    // Better Auth checks the request origin against BETTER_AUTH_URL.
    env: {
      PORT: String(port),
      HOSTNAME: "0.0.0.0",
      ENABLE_PRIMITIVES: "1",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_SITE_URL: baseURL,
      LEADS_INBOX: leadsInbox,
      CRON_SECRET: cronSecret,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
