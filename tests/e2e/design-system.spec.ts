import { expect, test } from "@playwright/test";

test("fonts swap without shifting layout on the home page", async ({ page }) => {
  // Hold the font files back so the fallback paints first and the swap
  // happens after layout, which is what a slow connection sees.
  await page.route("**/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number }>) {
        w.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.fonts.check("300 1em alethia"))).toBe(true);
  // Let any shift caused by the swap be recorded.
  await page.waitForTimeout(300);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThan(0.001);
});

test("primitives render at 320 px without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const response = await page.goto("/primitivler");
  expect(response?.status()).toBe(200);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("every control shows a focus ring from the keyboard", async ({ page }) => {
  await page.goto("/primitivler");
  // Start inside the content, past the header (covered in shell.spec.ts).
  await page.locator("#main").focus();
  await page.keyboard.press("Tab");
  for (let i = 0; i < 12; i += 1) {
    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "none";
      // The checkbox draws its ring on the sibling box, a card link on the
      // overlay that stretches it over the card.
      const target = el.matches("input[type=checkbox]") ? el.nextElementSibling : el;
      if (!target) return "none";
      const own = getComputedStyle(target).outlineStyle;
      return own !== "none" ? own : getComputedStyle(target, "::after").outlineStyle;
    });
    expect(outline).toBe("solid");
    await page.keyboard.press("Tab");
  }
});
