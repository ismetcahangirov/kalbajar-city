import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { asc, eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { faq, layoutTypes, settings } from "@/db/schema";
import * as seed from "@/db/seed/data";
import { publicFaqItems } from "@/lib/faq-facts";
import { settingsSchemas } from "@/shared/settings";

import { waitForHydration } from "./hydration";

/*
 * Search and AI answer crawlers often read only the first HTML response
 * (#29). Every text a visitor sees in a page's main content must already be
 * in that response: nothing important may appear only after JavaScript runs.
 */
test.skip(({ isMobile }) => isMobile, "the server's HTML does not depend on the viewport");

const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const entities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Text, whitespace collapsed, so markup and DOM text compare equal. */
const plain = (text: string) => text.replaceAll(" ", " ").replace(/\s+/g, " ").trim();

/** The text of `<main>` in the server's first response, as a crawler without JavaScript reads it. */
async function serverText(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(path, { headers: { "user-agent": googlebot } });
  expect(response.status(), path).toBe(200);
  const html = await response.text();
  const start = html.indexOf("<main");
  expect(start, `${path} has a <main>`).toBeGreaterThan(-1);
  const main = html.slice(start, html.indexOf("</main>", start));
  return plain(
    main
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&(amp|lt|gt|quot|nbsp|#x27|#39);/g, (entity) => entities[entity] ?? entity),
  );
}

/**
 * Every text node of `<main>` once the page has hydrated. The text reveals
 * split lines into an aria-hidden visual copy after hydration; the real text
 * stays beside it, so the copy is skipped.
 */
function hydratedTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [];
    const texts = new Set<string>();
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      // Forms are interactive islands, not content a crawler needs.
      if (!parent || parent.closest('form, script, style, template, [aria-hidden="true"]')) {
        continue;
      }
      const text = (node.textContent ?? "").trim();
      if (text.length > 1) texts.add(text);
    }
    return [...texts];
  });
}

async function anApartment(request: APIRequestContext): Promise<string> {
  const list = await request.get("/api/v1/apartments?status=available&pageSize=1");
  const [first] = ((await list.json()) as { items: Array<{ slug: string }> }).items;
  expect(first, "the seed has available apartments").toBeTruthy();
  return `/menziller/${first!.slug}`;
}

const pages = [
  "/",
  "/menziller",
  "/kompleks",
  "/haqqimizda",
  "/yerlesme",
  "/tikinti",
  "/qalereya",
  "/xeberler",
  "/elaqe",
  "/en",
  "/ru/haqqimizda",
];

test("every primary page's main content is in the first HTML response", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  for (const path of [...pages, await anApartment(request)]) {
    // Specs on other workers save the contacts for a moment (#27), so the two
    // renders can differ while one runs: compare again until both agree.
    await expect(async () => {
      await page.goto(path);
      await waitForHydration(page);
      const texts = await hydratedTexts(page);
      expect(texts.length, `${path} has content`).toBeGreaterThan(0);
      const server = await serverText(request, path);
      // Without whitespace, which the line splitting changes.
      const bare = (text: string) => text.replace(/\s+/g, "");
      const missing = texts.map(plain).filter((text) => !bare(server).includes(bare(text)));
      expect(missing, `${path}: text that appears only after JavaScript`).toEqual([]);
    }).toPass({ timeout: 30_000 });
  }
});

test("the FAQ's answers are in the home page's HTML and in llms-az.txt", async ({ request }) => {
  const { db, close } = connect(databaseUrl());
  const [rows, [complexRow], layouts] = await Promise.all([
    db
      .select({ question: faq.question, answer: faq.answer })
      .from(faq)
      .where(eq(faq.status, "published"))
      .orderBy(asc(faq.sortOrder)),
    db.select().from(settings).where(eq(settings.key, "complex")),
    db.select({ rooms: layoutTypes.rooms, areaTotal: layoutTypes.areaTotal }).from(layoutTypes),
  ]).finally(close);
  expect(rows.length, "the seed publishes FAQ entries").toBeGreaterThan(0);
  // As the site prints them: fact placeholders filled from the settings and the layouts (#29).
  const saved = settingsSchemas.complex.safeParse(complexRow?.value);
  const complex = saved.success ? saved.data : seed.settings.complex;
  const items = publicFaqItems(rows, "az", { complex, layouts });
  expect(items.length, "the seeded facts fill every seeded placeholder").toBe(rows.length);

  const home = await serverText(request, "/");
  const llms = plain(await (await request.get("/llms-az.txt")).text());
  for (const { question, answer } of items) {
    for (const text of [question.value, answer.value].map(plain)) {
      expect(home, text).toContain(text);
      expect(llms, text).toContain(text);
    }
  }
});
