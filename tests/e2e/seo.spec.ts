import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { legacyRedirects } from "@/config/legacy-redirects";
import type { AdminNews } from "@/shared/content";

import { ensureAccount, signIn } from "./console";

// Metadata does not depend on the viewport, and one test publishes an
// article: the file runs once, on desktop, in one worker.
test.skip(({ isMobile }) => isMobile, "metadata does not depend on the viewport");
test.describe.configure({ mode: "serial" });

const editor = "e2e-seo@test.kalbajarcity.com";
const locales = ["az", "en", "ru"] as const;
const prefix = { az: "", en: "/en", ru: "/ru" } as const;
/** A crawler: the initial HTML must carry everything, with no script run. */
const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

type Head = {
  canonicals: string[];
  alternates: Record<string, string[]>;
  robots: string | null;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  jsonLd: string[];
};

/** The metadata a crawler reads from the first response, before any script. */
async function headOf(request: APIRequestContext, path: string): Promise<Head> {
  const response = await request.get(path, { headers: { "user-agent": googlebot } });
  expect(response.status(), path).toBe(200);
  const html = await response.text();
  const head = html.slice(0, html.indexOf("</head>"));
  const attr = (tag: string, name: string) =>
    tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] ?? null;
  const tags = (pattern: RegExp) => [...head.matchAll(pattern)].map((match) => match[0]);

  const alternates: Record<string, string[]> = {};
  for (const tag of tags(/<link rel="alternate" hrefLang="[^"]*"[^>]*>/gi)) {
    const lang = attr(tag, "hrefLang")!;
    (alternates[lang] ??= []).push(attr(tag, "href")!);
  }
  return {
    canonicals: tags(/<link rel="canonical"[^>]*>/gi).map((tag) => attr(tag, "href")!),
    alternates,
    robots: tags(/<meta name="robots"[^>]*>/gi).map((tag) => attr(tag, "content"))[0] ?? null,
    title: head.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    description:
      tags(/<meta name="description"[^>]*>/gi).map((tag) => attr(tag, "content"))[0] ?? null,
    ogImage:
      tags(/<meta property="og:image"[^>]*>/gi).map((tag) => attr(tag, "content"))[0] ?? null,
    // The JSON-LD is in the body; count it on the whole document.
    jsonLd: [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map(
      (match) => match[1]!,
    ),
  };
}

/** The first apartment the Azerbaijani sitemap lists, as a path. */
async function anApartment(request: APIRequestContext): Promise<string> {
  const xml = await (await request.get("/sitemap/az.xml")).text();
  const loc = xml.match(/<loc>([^<]*\/menziller\/[^<]+)<\/loc>/)?.[1];
  expect(loc, "the sitemap lists an apartment").toBeTruthy();
  return new URL(loc!).pathname;
}

/** The one JSON-LD document of a page, its nodes by type. */
function graphOf(jsonLd: string[]): Map<string, Record<string, unknown>> {
  expect(jsonLd, "one JSON-LD script per page").toHaveLength(1);
  const data = JSON.parse(jsonLd[0]!) as {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  };
  expect(data["@context"]).toBe("https://schema.org");
  const nodes = new Map<string, Record<string, unknown>>();
  for (const node of data["@graph"]) {
    expect(typeof node["@type"]).toBe("string");
    nodes.set(node["@type"] as string, node);
  }
  return nodes;
}

function expectOrganization(nodes: Map<string, Record<string, unknown>>, origin: string) {
  const organization = nodes.get("Organization");
  expect(organization).toMatchObject({
    "@id": `${origin}/#organization`,
    name: expect.any(String),
  });
  expect(organization?.url).toMatch(/^https?:\/\//);
}

function expectBreadcrumbs(nodes: Map<string, Record<string, unknown>>, length: number) {
  const list = nodes.get("BreadcrumbList")?.itemListElement as Array<Record<string, unknown>>;
  expect(list).toHaveLength(length);
  list.forEach((item, i) => {
    expect(item).toMatchObject({ "@type": "ListItem", position: i + 1, name: expect.any(String) });
    expect(item.item).toMatch(/^https?:\/\//);
  });
}

/** Exactly one canonical (the page itself) and one alternate per locale plus x-default. */
function expectIndexable(
  head: Head,
  origin: string,
  locale: (typeof locales)[number],
  path: string,
) {
  const url = (l: (typeof locales)[number]) => `${origin}${prefix[l]}${path === "/" ? "" : path}`;
  const own = url(locale) || origin;
  expect(head.robots, path).toBeNull();
  expect(head.canonicals, path).toEqual([own]);
  expect(Object.keys(head.alternates).sort(), path).toEqual(["az", "en", "ru", "x-default"]);
  for (const l of locales) expect(head.alternates[l], `${path} ${l}`).toEqual([url(l) || origin]);
  expect(head.alternates["x-default"], path).toEqual([url("az") || origin]);
  expect(head.title, path).toBeTruthy();
  expect(head.description, path).toBeTruthy();
  expect(head.ogImage, path).toMatch(/^https?:\/\/.*\/opengraph-image$/);
}

let article: { id: string; slug: string } | null = null;

test.beforeAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "desktop") return;
  await ensureAccount("editor", editor, "E2E SEO Redaktor");
  const page: Page = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  await signIn(page, editor, testInfo.project.use.baseURL!);
  const slug = `e2e-seo-${randomUUID().slice(0, 6)}`;
  const created = await page.request.post("/api/v1/admin/news", {
    data: {
      slug,
      title: { az: "SEO sınaq xəbəri", en: "SEO test article", ru: "Тестовая статья SEO" },
      excerpt: { az: "Qısa xülasə.", en: "A short summary.", ru: "Краткое описание." },
      body: {
        az: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Mətn." }] }],
        },
      },
    },
  });
  expect(created.status()).toBe(201);
  const news = (await created.json()) as AdminNews;
  article = { id: news.id, slug };
  const published = await page.request.put(`/api/v1/admin/news/${news.id}/publication`, {
    data: {},
  });
  expect(published.status()).toBe(200);
  await page.close();
});

test.afterAll(async ({ browser }, testInfo) => {
  if (testInfo.project.name !== "desktop" || !article) return;
  const page = await browser.newPage({ baseURL: testInfo.project.use.baseURL });
  await signIn(page, editor, testInfo.project.use.baseURL!);
  expect((await page.request.delete(`/api/v1/admin/news/${article.id}`)).status()).toBe(204);
  await page.close();
});

test("every indexable page has one canonical and the full hreflang set, in the first HTML", async ({
  request,
  baseURL,
}) => {
  const paths = [
    "/",
    "/menziller",
    "/menziller?otaq=2",
    await anApartment(request),
    "/haqqimizda",
    "/yerlesme",
    "/tikinti",
    "/qalereya",
    "/xeberler",
    `/xeberler/${article!.slug}`,
    "/elaqe",
    "/mexfilik-siyaseti",
  ];
  for (const locale of locales) {
    for (const path of paths) {
      expectIndexable(await headOf(request, `${prefix[locale]}${path}`), baseURL!, locale, path);
    }
  }
});

test("views of a page are noindex with a canonical to the page; fixtures stay noindex", async ({
  request,
  baseURL,
}) => {
  const views = [
    ["/en/menziller?otaq=2&blok=A", "/en/menziller"],
    ["/qalereya?kateqoriya=yoxdur", "/qalereya"],
    ["/ru/kompleks", "/ru/kompleks"],
  ] as const;
  for (const [path, canonical] of views) {
    const head = await headOf(request, path);
    expect(head.robots, path).toBe("noindex, follow");
    expect(head.canonicals, path).toEqual([`${baseURL}${canonical}`]);
    expect(head.alternates, path).toEqual({});
  }
  expect((await headOf(request, "/primitivler")).robots).toBe("noindex, nofollow");
});

test("the sitemap index and each locale's sitemap parse and list only indexable URLs", async ({
  page,
  request,
  baseURL,
}) => {
  const parse = (xml: string) =>
    page.evaluate((text) => {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      if (doc.querySelector("parsererror")) return null;
      const ns = "http://www.w3.org/1999/xhtml";
      return {
        root: doc.documentElement.localName,
        locs: [...doc.getElementsByTagName("loc")].map((loc) => loc.textContent ?? ""),
        links: [...doc.getElementsByTagName("url")].map(
          (url) => url.getElementsByTagNameNS(ns, "link").length,
        ),
        lastmods: [...doc.getElementsByTagName("lastmod")].map((node) => node.textContent ?? ""),
      };
    }, xml);

  const indexResponse = await request.get("/sitemap.xml");
  expect(indexResponse.headers()["content-type"]).toContain("xml");
  const index = await parse(await indexResponse.text());
  expect(index?.root).toBe("sitemapindex");
  expect(index?.locs).toEqual(locales.map((l) => `${baseURL}/sitemap/${l}.xml`));

  const paths: Record<string, string[]> = {};
  for (const locale of locales) {
    const sitemap = await parse(await (await request.get(`/sitemap/${locale}.xml`)).text());
    expect(sitemap?.root).toBe("urlset");
    for (const loc of sitemap!.locs)
      expect(loc.startsWith(`${baseURL}${prefix[locale]}`)).toBe(true);
    // Each URL names itself and the other locales, plus x-default.
    for (const count of sitemap!.links) expect(count).toBe(4);
    for (const date of sitemap!.lastmods) expect(Number.isNaN(Date.parse(date))).toBe(false);
    paths[locale] = sitemap!.locs.map(
      (loc) => loc.slice(`${baseURL}${prefix[locale]}`.length) || "/",
    );
    expect(paths[locale]).toContain(`/xeberler/${article!.slug}`);
    expect(paths[locale]).not.toContain("/kompleks");
  }
  expect(paths.en).toEqual(paths.az);
  expect(paths.ru).toEqual(paths.az);

  // No listed page is noindex: every page but the apartments, and a few apartments.
  const apartments = paths.az!.filter((path) => path.startsWith("/menziller/"));
  const sample = [
    ...paths.az!.filter((path) => !path.startsWith("/menziller/")),
    ...apartments.slice(0, 3),
  ];
  for (const locale of locales) {
    for (const path of sample) {
      const head = await headOf(request, `${prefix[locale]}${path === "/" ? "" : path}` || "/");
      expect(head.robots, path).toBeNull();
    }
  }
});

test("robots.txt opens the site, closes the console and the API, and names the sitemap", async ({
  request,
  baseURL,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.headers()["content-type"]).toContain("text/plain");
  const lines = (await response.text()).split("\n").map((line) => line.trim());
  expect(lines).toContain("User-Agent: *");
  expect(lines).toContain("Allow: /");
  expect(lines).toContain("Disallow: /admin");
  expect(lines).toContain("Disallow: /api");
  expect(lines).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test("home publishes the Organization, the complex and the FAQ as JSON-LD", async ({
  request,
  baseURL,
}) => {
  const nodes = graphOf((await headOf(request, "/en")).jsonLd);
  expectOrganization(nodes, baseURL!);
  expect(nodes.get("ApartmentComplex")).toMatchObject({
    "@id": `${baseURL}/#complex`,
    name: "Kalbajar City",
    url: `${baseURL}/en`,
  });
  // Address and coordinates are unset in the seed (#7): left out, not guessed.
  expect(nodes.get("ApartmentComplex")).not.toHaveProperty("geo");
  const faq = nodes.get("FAQPage")?.mainEntity as Array<Record<string, unknown>>;
  expect(faq.length).toBeGreaterThan(0);
  for (const question of faq) {
    expect(question).toMatchObject({
      "@type": "Question",
      name: expect.any(String),
      acceptedAnswer: { "@type": "Answer", text: expect.any(String) },
    });
  }
});

test("an apartment publishes Apartment, Offer and breadcrumbs", async ({ request, baseURL }) => {
  const path = await anApartment(request);
  const nodes = graphOf((await headOf(request, path)).jsonLd);
  expectOrganization(nodes, baseURL!);
  expectBreadcrumbs(nodes, 3);
  expect(nodes.get("Apartment")).toMatchObject({
    name: expect.any(String),
    url: `${baseURL}${path}`,
    numberOfRooms: expect.any(Number),
    floorSize: { "@type": "QuantitativeValue", value: expect.any(Number), unitCode: "MTK" },
  });
  const offer = nodes.get("Offer");
  expect(offer?.availability).toMatch(/^https:\/\/schema\.org\/(InStock|Reserved|SoldOut)$/);
  // Prices are hidden in the seed (settings.prices.visible = false).
  expect(offer).not.toHaveProperty("price");
});

test("an article publishes NewsArticle and breadcrumbs", async ({ request, baseURL }) => {
  const path = `/en/xeberler/${article!.slug}`;
  const nodes = graphOf((await headOf(request, path)).jsonLd);
  expectOrganization(nodes, baseURL!);
  expectBreadcrumbs(nodes, 3);
  const news = nodes.get("NewsArticle");
  expect(news).toMatchObject({
    headline: "SEO test article",
    url: `${baseURL}${path}`,
    datePublished: expect.any(String),
    dateModified: expect.any(String),
    author: [{ "@type": "Organization", name: expect.any(String) }],
  });
  expect(news?.image).toContain(`${baseURL}${path}/opengraph-image`);
});

test("Open Graph cards are PNG images", async ({ request }) => {
  const paths = [
    "/opengraph-image",
    "/ru/opengraph-image",
    `${await anApartment(request)}/opengraph-image`,
    `/en/xeberler/${article!.slug}/opengraph-image`,
  ];
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toBe("image/png");
    expect((await response.body()).subarray(1, 4).toString(), path).toBe("PNG");
  }
});

test("every legacy URL answers 301 to its new page", async ({ request, baseURL }) => {
  for (const { from, to } of legacyRedirects) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(301);
    expect(new URL(response.headers().location!, baseURL).pathname, from).toBe(to);
  }
});
