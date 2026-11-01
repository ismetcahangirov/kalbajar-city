import type { Page } from "@playwright/test";

/**
 * Waits until React has hydrated the page. `networkidle` cannot be used for
 * this: link prefetches under `partialPrefetching` read only part of their
 * response stream, so the browser keeps them open and the network never
 * goes idle.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const header = document.querySelector("[data-site-header]");
    return header !== null && Object.keys(header).some((key) => key.startsWith("__reactFiber"));
  });
}
