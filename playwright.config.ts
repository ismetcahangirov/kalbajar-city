import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// The server reads DATABASE_URL; pages such as home render from the database.
if (existsSync(".env")) process.loadEnvFile(".env");

const port = Number(process.env.E2E_PORT ?? 3011);
const baseURL = `http://localhost:${port}`;

/** Where the E2E server sends lead e-mails; tests/e2e/leads.spec.ts reads them from Mailpit. */
const leadsInbox = "sales@e2e.kalbajarcity.test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // An Azerbaijani browser by default, so the locale suggestion stays hidden
  // unless a test asks for another language.
  use: { baseURL, trace: "retain-on-failure", locale: "az-AZ" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
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
    },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
