import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import az from "@/i18n/messages/az.json";

import { waitForHydration } from "./hydration";
import { fontsReady, localized, locales, publicRoutes, withArticle } from "./public-routes";

/*
 * axe-core on every public route in every locale, at both projects' viewports
 * (#30): zero violations of WCAG 2.0, 2.1 and 2.2 A and AA. A rule is never
 * disabled to make this pass; a violation is fixed in the page.
 */

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** axe's violations on the page as it is now, in a form a failure message can show. */
async function violations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(tags);
  if (include) builder.include(include);
  const results = await builder.analyze();
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target.join(" "),
      summary: node.failureSummary,
    })),
  }));
}

let article: Awaited<ReturnType<typeof withArticle>>;

test.beforeAll(async ({}, testInfo) => {
  article = await withArticle(
    `http://localhost:${process.env.E2E_PORT ?? 3011}`,
    `axe-${testInfo.project.name}`,
  );
});

test.afterAll(async () => {
  await article?.remove();
});

for (const locale of locales) {
  for (const route of publicRoutes("{article}")) {
    test(`${route.name} in ${locale} has no axe violations`, async ({ page }) => {
      const path = localized(locale, route.path.replace("{article}", article.slug));
      const response = await page.goto(path);
      expect(response?.status()).toBe(route.status);
      await waitForHydration(page);
      await fontsReady(page);

      const found = await violations(page);
      expect(found, `${path}: ${JSON.stringify(found, null, 2)}`).toEqual([]);
    });
  }
}

// The dialogs every page can open: the menu and the inquiry form.
test.describe("dialogs", () => {
  test("the menu has no axe violations", async ({ page }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    await page.getByRole("banner").getByRole("button", { name: az.Shell.openMenu }).click();
    await expect(page.getByRole("dialog", { name: az.Shell.menu })).toBeVisible();
    const found = await violations(page, 'dialog[open], [role="dialog"]');
    expect(found, JSON.stringify(found, null, 2)).toEqual([]);
  });

  test("the inquiry form has no axe violations", async ({ page, isMobile }) => {
    await page.goto("/haqqimizda");
    await waitForHydration(page);
    // The header link from lg; the menu's below it.
    if (isMobile) {
      await page.getByRole("banner").getByRole("button", { name: az.Shell.openMenu }).click();
      await page
        .getByRole("dialog", { name: az.Shell.menu })
        .getByRole("link", { name: az.Shell.inquire })
        .click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: az.Shell.inquire }).click();
    }
    const dialog = page.getByRole("dialog", { name: az.Shell.inquire });
    // The deferred form has arrived when its submit button is there.
    await expect(dialog.getByRole("button", { name: az.LeadForm.submit.inquiry })).toBeVisible();
    const found = await violations(page, 'dialog[open], [role="dialog"]');
    expect(found, JSON.stringify(found, null, 2)).toEqual([]);
  });
});
