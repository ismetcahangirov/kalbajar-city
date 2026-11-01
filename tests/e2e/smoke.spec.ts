import { expect, test } from "@playwright/test";

test("home page renders in Azerbaijani without horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "az");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kalbajar City");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("health route answers", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});
