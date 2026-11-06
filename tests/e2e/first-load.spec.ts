import { expect, test } from "@playwright/test";

// What keeps mobile home inside its Lighthouse budget (#30, CLAUDE.md §5), as
// behaviour a browser can check: the bytes of a first view, not their timing.

const fontsOf = (urls: string[]) =>
  urls.filter((url) => url.endsWith(".woff2")).map((url) => url.split("/").pop()!);

test("an Azerbaijani page fetches only the core font files", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const fonts = fontsOf(urls);
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((name) => !/_Core\./.test(name))).toEqual([]);
});

test("a Russian page sets its letters in Alethia Next, from the Cyrillic files", async ({
  page,
}) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.goto("/ru");
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('400 16px "Alethia Cyrillic"', "Яя")))
    .toBe(true);
  expect(fontsOf(urls).some((name) => /Cyrillic/.test(name))).toBe(true);
  expect(fontsOf(urls).filter((name) => /Extended/.test(name))).toEqual([]);
});

test("a rare Latin letter comes from the extended file, not the fallback", async ({ page }) => {
  await page.goto("/");
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 16px "Alethia Extended"', "ñ");
    return faces.map((face) => face.family);
  });
  expect(loaded.join()).toContain("Alethia Extended");
});

test("on a phone, every image but the hero's panel waits for the preloader, and nothing moves when they appear", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, "On desktop a few frames take their height from the image, so they load.");
  await context.clearCookies({ name: "kc-skip-preloader" });
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") images.push(request.url());
  });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-preloader", "on");

  // The hero's panel, the LCP image, is requested as usual. The poster in the
  // hero tile and what is below the hero are not, and cannot show yet.
  await expect
    .poll(() => images.some((url) => url.includes("/defaults/home.hero.panel/")))
    .toBe(true);
  expect(
    images.filter((url) => /\/defaults\/home\.(hero\.poster|about|stats)\./.test(url)),
  ).toEqual([]);
  const heightUnder = await page.evaluate(() => document.documentElement.scrollHeight);

  await expect(html).toHaveAttribute("data-preloader", "done", { timeout: 10_000 });
  const hidden = await page.evaluate(
    () =>
      [...document.querySelectorAll("main img")].filter(
        (image) => getComputedStyle(image).display === "none",
      ).length,
  );
  expect(hidden).toBe(0);
  // The poster is in the first screen, so it is fetched as soon as it may show.
  await expect
    .poll(() => images.some((url) => url.includes("/defaults/home.hero.poster/")))
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(heightUnder);
});

test("the inquiry form still validates when its schema is not loaded yet", async ({ page }) => {
  await page.goto("/elaqe");
  await page.waitForFunction(() => {
    const form = document.querySelector("main form");
    return !!form && Object.keys(form).some((key) => key.startsWith("__react"));
  });
  // Straight to the button: no field took focus, so the schema has not been fetched.
  const form = page.locator("main form").first();
  await form.getByRole("button").last().click();
  await expect(form.locator('[aria-invalid="true"]').first()).toBeVisible();
});

test("scripts and images do not carry the document-only headers", async ({ request }) => {
  const document = await request.get("/");
  expect(document.headers()["content-security-policy"]).toBeTruthy();
  expect(document.headers()["x-frame-options"]).toBe("DENY");

  const file = await request.get("/defaults/home.hero.panel/480.avif");
  expect(file.status()).toBe(200);
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");
  expect(file.headers()["strict-transport-security"]).toBeTruthy();
  expect(file.headers()["content-security-policy"]).toBeUndefined();
});
