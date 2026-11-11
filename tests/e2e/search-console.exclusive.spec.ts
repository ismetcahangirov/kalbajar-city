import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { formatPhone } from "@/i18n/format";
import type { AdminSetting, SettingsValue } from "@/shared/settings";

import { ensureAccount, signIn, waitForShell } from "./console";
import { flaggedPaths, patchContacts, readContacts, restoreFlags } from "./settings";

/*
 * Search Console and Bing verification (#28, #29), and the name, address and
 * phone every output states (#29). Both change what every page carries, so
 * this file runs in the `exclusive` project, after the others
 * (playwright.config.ts), one test at a time.
 */
test.describe.configure({ mode: "serial" });

const googlebot = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const plain = (text: string) => text.replaceAll(" ", " ").replace(/\s+/g, " ").trim();

async function signInOwner(page: Page, baseURL: string) {
  const email = "e2e-search-console@test.kalbajarcity.com";
  await ensureAccount("owner", email, "E2E Search Console Owner");
  await signIn(page, email, baseURL);
}

async function head(request: APIRequestContext, path: string): Promise<string> {
  const html = await (await request.get(path, { headers: { "user-agent": googlebot } })).text();
  return html.slice(0, html.indexOf("</head>"));
}

async function readAnalytics(request: APIRequestContext) {
  const response = await request.get("/api/v1/admin/settings/analytics");
  expect(response.status()).toBe(200);
  return ((await response.json()) as AdminSetting<"analytics">).value;
}

async function writeAnalytics(request: APIRequestContext, value: SettingsValue<"analytics">) {
  const response = await request.put("/api/v1/admin/settings/analytics", { data: value });
  expect(response.status()).toBe(200);
}

test("verification tokens saved in the console are in every page's head, and only then", async ({
  page,
  baseURL,
}) => {
  await signInOwner(page, baseURL!);
  const original = await readAnalytics(page.request);
  const google = "e2e-Google_verification-token-0123456789ab";
  const bing = "0123456789ABCDEF0123456789ABCDEF";

  try {
    await writeAnalytics(page.request, {
      ...original,
      googleSiteVerification: null,
      bingSiteVerification: null,
    });
    for (const path of ["/", "/en/menziller"]) {
      const tags = await head(page.request, path);
      expect(tags, path).not.toContain('name="google-site-verification"');
      expect(tags, path).not.toContain('name="msvalidate.01"');
    }

    await page.goto("/admin/ayarlar/analitika");
    await waitForShell(page);
    const googleField = page.getByRole("textbox", { name: "Google Search Console təsdiq kodu" });
    const bingField = page.getByRole("textbox", { name: /^Bing Webmaster təsdiq kodu/ });

    // Not a token: the form says so and saves nothing.
    await bingField.fill("not-a-token");
    await page.getByRole("button", { name: "Yadda saxla" }).click();
    await expect(page.getByText("Bu, Bing təsdiq kodu deyil", { exact: false })).toBeVisible();

    // The whole tag, as Search Console shows it, is fine: the form keeps its content.
    await googleField.fill(`<meta name="google-site-verification" content="${google}" />`);
    await bingField.fill(bing);
    await page.getByRole("button", { name: "Yadda saxla" }).click();
    await expect(page.getByText("Ayarlar yadda saxlanıldı")).toBeVisible();
    await expect(googleField).toHaveValue(google);

    for (const path of ["/", "/en/menziller", "/ru/elaqe"]) {
      const tags = await head(page.request, path);
      expect(tags, path).toContain(`<meta name="google-site-verification" content="${google}"/>`);
      expect(tags, path).toContain(`<meta name="msvalidate.01" content="${bing}"/>`);
    }
  } finally {
    await writeAnalytics(page.request, original);
  }
});

test("the name, address and phone agree across the pages, the structured data and llms.txt", async ({
  page,
  baseURL,
}) => {
  await signInOwner(page, baseURL!);
  const original = await readContacts(page.request);
  const flags = await flaggedPaths();
  const phones = ["+994125550303", "+994505550404"];
  const address = { az: "E2E ünvanı, Kəlbəcər", en: "E2E address, Kalbajar", ru: "Адрес E2E" };

  try {
    // Saved in the console, so neither is a stand-in any more.
    await patchContacts(page.request, { phones, address });

    // The pages: the wordmark, the call links and the contact page's address.
    await page.goto("/");
    const name = plain(await page.locator('header a[href="/"] [lang="en"]').first().innerText());
    expect(name).not.toBe("");
    const footerPhones = await page
      .locator('#site-footer a[href^="tel:"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")!.slice(4)));
    expect(footerPhones).toEqual(phones);
    await expect(page.locator(`header a[href="tel:${phones[0]}"]`).first()).toBeAttached();
    // The FAQ (answers folded, so its text) quotes the main line, not a typed number.
    expect(plain((await page.locator("main").textContent()) ?? "")).toContain(
      plain(formatPhone(phones[0]!)),
    );

    await page.goto("/elaqe");
    await expect(page.locator("main address")).toContainText(address.az);

    // The structured data.
    const html = await (
      await page.request.get("/", { headers: { "user-agent": googlebot } })
    ).text();
    const json = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1];
    const graph = (JSON.parse(json!) as { "@graph": Array<Record<string, unknown>> })["@graph"];
    const complex = graph.find((node) => node["@type"] === "ApartmentComplex")!;
    const organization = graph.find((node) => node["@type"] === "Organization")!;
    expect(complex.name).toBe(name);
    expect(complex.telephone).toBe(phones[0]);
    expect(complex.address).toMatchObject({ streetAddress: address.az });
    expect(
      (organization.contactPoint as Array<{ telephone: string }>).map((point) => point.telephone),
    ).toEqual(phones);

    // llms.txt.
    const llms = plain(await (await page.request.get("/llms-az.txt")).text());
    expect(llms.startsWith(`# ${name} `)).toBe(true);
    for (const phone of phones) expect(llms).toContain(`- Telefon: ${plain(formatPhone(phone))}`);
    expect(llms).toContain(`- Ünvan: ${address.az}`);
  } finally {
    await patchContacts(page.request, { phones: original.phones, address: original.address });
    await restoreFlags(page.request, flags);
  }
});
