import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3011);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
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
    env: { PORT: String(port), HOSTNAME: "0.0.0.0" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
