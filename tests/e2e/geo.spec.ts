import { expect, test, type APIRequestContext } from "@playwright/test";

import { answerCrawlers } from "@/lib/seo/robots";

import { flaggedPaths } from "./settings";

// Plain-text and head checks: the viewport does not matter.
test.skip(({ isMobile }) => isMobile, "crawler-facing output does not depend on the viewport");

const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const plain = (text: string) => text.replaceAll("\u00a0", " ").replace(/\s+/g, " ").trim();

/** The about page's facts block, as a crawler reads it from the first response. */
async function factsOf(request: APIRequestContext, path: string): Promise<string[]> {
  const html = await (await request.get(path, { headers: { "user-agent": googlebot } })).text();
  const start = html.indexOf('aria-labelledby="faktlar"');
  expect(start, path).toBeGreaterThan(-1);
  const block = html.slice(start, html.indexOf("</ul>", start));
  return [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) =>
    plain(match[1]!.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "")),
  );
}

test("robots.txt welcomes search and AI answer crawlers but keeps them out of the console", async ({
  request,
}) => {
  const text = await (await request.get("/robots.txt")).text();
  for (const bot of answerCrawlers) expect(text).toContain(`User-Agent: ${bot}`);
  // Each named group repeats the exclusions, since a crawler reads only its own group.
  expect(text.match(/Disallow: \/admin/g)?.length).toBe(2);
});

for (const [path, about, heading] of [
  ["/llms.txt", "/en/haqqimizda", "## Key facts"],
  ["/llms-az.txt", "/haqqimizda", "## Əsas faktlar"],
] as const) {
  test(`${path} states the same facts as ${about}`, async ({ request, baseURL }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    const text = await response.text();
    expect(text.startsWith("# Kalbajar City\n")).toBe(true);
    expect(text).toContain(heading);
    expect(text).toContain(`${baseURL}/`);

    const facts = await factsOf(request, about);
    expect(facts.length).toBeGreaterThan(2);
    for (const fact of facts) expect(text, fact).toContain(`- ${fact}`);
  });
}

test("every page names the region and place for local search", async ({ request }) => {
  for (const [path, place] of [
    ["/", "Kəlbəcər, Azərbaycan"],
    ["/en/menziller", "Kalbajar, Azerbaijan"],
    ["/ru/elaqe", "Кельбаджар, Азербайджан"],
  ] as const) {
    const html = await (await request.get(path, { headers: { "user-agent": googlebot } })).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head, path).toContain('<meta name="geo.region" content="AZ-KAL"/>');
    expect(head, path).toContain(`<meta name="geo.placename" content="${place}"/>`);
  }
});

test("no analytics script loads until the console sets an ID", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).not.toContain("googletagmanager.com/gtag");
  expect(html).not.toContain("fbevents.js");
});

test("seeded stand-ins never reach the geo meta, the structured data or llms.txt", async ({
  request,
}) => {
  // Other specs save the contacts for a moment (#27), which clears these
  // flags until they restore them: check only what is still a stand-in.
  const standIns = await flaggedPaths();
  const html = await (await request.get("/en", { headers: { "user-agent": googlebot } })).text();
  const head = html.slice(0, html.indexOf("</head>"));
  const llms = await (await request.get("/llms.txt")).text();
  if (standIns.includes("contacts.coordinates")) {
    expect(head).not.toContain('name="geo.position"');
    expect(head).not.toContain('name="ICBM"');
    expect(html).not.toContain('"GeoCoordinates"');
  }
  if (standIns.includes("contacts.email")) {
    expect(html).not.toContain('"email":');
    expect(llms).not.toMatch(/^- E-mail:/m);
  }
  if (standIns.includes("contacts.hours")) expect(llms).not.toMatch(/^- (Office )?hours:/im);
  if (standIns.includes("contacts.address")) expect(html).not.toContain('"PostalAddress"');
});
