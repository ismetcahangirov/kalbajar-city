import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { legacyRedirects } from "@/config/legacy-redirects";
import { pathnames } from "@/i18n/routing";
import {
  apartmentComplexNode,
  apartmentNodes,
  breadcrumbNode,
  faqNode,
  jsonLdGraph,
  newsArticleNode,
  organizationNode,
  priceFromMinor,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import {
  buildPageMetadata,
  geoMeta,
  languageAlternates,
  localizedPaths,
  overrideKey,
  type PageSeo,
  type SeoContext,
} from "@/lib/seo/metadata";
import { parsePalette } from "@/lib/seo/palette";
import { sitemapEntries, sitemapIndexXml, sitemapXml, type SitemapData } from "@/lib/seo/sitemap";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

const origin = "https://kalbajarcity.com";
const context: SeoContext = { origin, siteName: "Kalbajar City", override: null };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("site URLs", () => {
  it("reads the origin at run time and drops a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.az/");
    expect(siteOrigin()).toBe("https://example.az");
    expect(absoluteUrl("/menziller")).toBe("https://example.az/menziller");
  });

  it("names the home page by its bare origin", () => {
    expect(absoluteUrl("/", origin)).toBe(origin);
    expect(absoluteUrl("/en", origin)).toBe(`${origin}/en`);
    expect(absoluteUrl("/menziller?otaq=2", origin)).toBe(`${origin}/menziller?otaq=2`);
  });
});

describe("localized paths and hreflang", () => {
  it("keeps Azerbaijani unprefixed and segments Azerbaijani in every locale", () => {
    expect(localizedPaths("/haqqimizda")).toEqual({
      az: "/haqqimizda",
      en: "/en/haqqimizda",
      ru: "/ru/haqqimizda",
    });
    expect(
      localizedPaths({ pathname: "/menziller/[slug]", params: { slug: "blok-a-menzil-101" } }),
    ).toEqual({
      az: "/menziller/blok-a-menzil-101",
      en: "/en/menziller/blok-a-menzil-101",
      ru: "/ru/menziller/blok-a-menzil-101",
    });
  });

  it("lists every locale and x-default → az as absolute URLs", () => {
    expect(languageAlternates("/", origin)).toEqual({
      az: origin,
      en: `${origin}/en`,
      ru: `${origin}/ru`,
      "x-default": origin,
    });
  });

  it("keys overrides by the Azerbaijani path, with a landing view's query", () => {
    expect(overrideKey("/elaqe")).toBe("/elaqe");
    expect(overrideKey({ pathname: "/menziller", query: { otaq: "2" } })).toBe("/menziller?otaq=2");
  });
});

describe("buildPageMetadata", () => {
  const page: PageSeo = {
    locale: "en",
    href: "/haqqimizda",
    title: "About",
    description: "The complex and its developer.",
  };

  it("gives an indexable page one canonical, its own, and the full hreflang set", () => {
    const metadata = buildPageMetadata(page, context);
    expect(metadata.alternates?.canonical).toBe(`${origin}/en/haqqimizda`);
    expect(metadata.alternates?.languages).toEqual({
      az: `${origin}/haqqimizda`,
      en: `${origin}/en/haqqimizda`,
      ru: `${origin}/ru/haqqimizda`,
      "x-default": `${origin}/haqqimizda`,
    });
    expect(metadata.robots).toBeUndefined();
    expect(metadata.title).toBe("About");
    expect(metadata.openGraph).toMatchObject({
      url: `${origin}/en/haqqimizda`,
      locale: "en_US",
      siteName: "Kalbajar City",
      images: [{ url: `${origin}/en/opengraph-image`, width: 1200, height: 630 }],
    });
  });

  it("makes a view of a page noindex, follow with a canonical to the page", () => {
    const metadata = buildPageMetadata(
      { ...page, href: "/xeberler", title: "News", indexable: false },
      context,
    );
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({ canonical: `${origin}/en/xeberler` });
  });

  it("points apartments and articles at their own card", () => {
    const metadata = buildPageMetadata(
      {
        locale: "az",
        href: { pathname: "/xeberler/[slug]", params: { slug: "ilk-xeber" } },
        title: "İlk xəbər",
        image: "own",
        article: { publishedTime: "2026-10-01T09:00:00.000Z" },
      },
      context,
    );
    expect(metadata.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-10-01T09:00:00.000Z",
      images: [{ url: `${origin}/xeberler/ilk-xeber/opengraph-image` }],
    });
  });

  it("lets the home page's title stand without the template", () => {
    const metadata = buildPageMetadata(
      { locale: "az", href: "/", title: "Kalbajar City", absoluteTitle: true },
      context,
    );
    expect(metadata.title).toEqual({ absolute: "Kalbajar City" });
    expect(metadata.alternates?.canonical).toBe(origin);
  });

  it("applies the console's override over the catalogue", () => {
    const metadata = buildPageMetadata(page, {
      ...context,
      override: {
        title: "About Kalbajar City",
        description: "Overridden.",
        noindex: true,
        image: "https://cdn.example/media/1/1600.webp",
      },
    });
    expect(metadata.title).toEqual({ absolute: "About Kalbajar City" });
    expect(metadata.description).toBe("Overridden.");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://cdn.example/media/1/1600.webp", alt: "About Kalbajar City" },
    ]);
  });

  it("adds geo meta only with coordinates", () => {
    expect(geoMeta(null)).toBeUndefined();
    expect(geoMeta({ lat: 40.1, lng: 46.04 })).toEqual({
      "geo.position": "40.1;46.04",
      ICBM: "40.1, 46.04",
    });
  });
});

describe("JSON-LD builders", () => {
  it("escapes < so no value can close the script", () => {
    const text = serializeJsonLd(jsonLdGraph([faqNode([{ question: "</script>", answer: "a" }])]));
    expect(text).not.toContain("</script>");
    expect(JSON.parse(text)["@graph"][0].mainEntity[0].name).toBe("</script>");
  });

  it("builds the Organization from settings, leaving out what is unknown", () => {
    const node = organizationNode({
      origin,
      name: "InCity Projects",
      website: null,
      sameAs: [
        "https://www.instagram.com/kalbajar.city/",
        null,
        "https://www.instagram.com/kalbajar.city/",
      ],
      phones: ["+994124343232"],
      email: null,
    });
    expect(node).toEqual({
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "InCity Projects",
      url: `${origin}/`,
      sameAs: ["https://www.instagram.com/kalbajar.city/"],
      contactPoint: [{ "@type": "ContactPoint", contactType: "sales", telephone: "+994124343232" }],
    });
    expect(node).not.toHaveProperty("logo");
  });

  it("names the logo once one is chosen in the console", () => {
    const logo = "https://cdn.example.test/media/1/960.webp";
    const node = organizationNode({
      origin,
      name: "InCity Projects",
      website: null,
      sameAs: [],
      phones: [],
      email: null,
      logo,
    });
    expect(node.logo).toBe(logo);
  });

  it("adds address and geo to the complex only once they are set", () => {
    const base = {
      origin,
      url: origin,
      name: "Kalbajar City",
      description: null,
      address: null,
      coordinates: null,
      apartments: 143,
      amenities: [],
    };
    const without = apartmentComplexNode(base);
    expect(without).not.toHaveProperty("address");
    expect(without).not.toHaveProperty("geo");
    expect(without).not.toHaveProperty("amenityFeature");
    const withPlace = apartmentComplexNode({
      ...base,
      address: "Kəlbəcər şəhəri",
      coordinates: { lat: 40.1, lng: 46.04 },
    });
    expect(withPlace.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Kəlbəcər şəhəri",
      addressCountry: "AZ",
    });
    expect(withPlace.geo).toEqual({ "@type": "GeoCoordinates", latitude: 40.1, longitude: 46.04 });
  });

  it("converts minor units to a schema.org price", () => {
    expect(priceFromMinor("12345600")).toBe("123456.00");
    expect(priceFromMinor("5")).toBe("0.05");
    expect(priceFromMinor("100")).toBe("1.00");
  });

  it("publishes a price only when it is public, and availability from the status", () => {
    const input = {
      origin,
      url: `${origin}/menziller/blok-a-menzil-101`,
      name: "A blok, mənzil 101",
      rooms: 1,
      area: 62.09,
      floor: 1,
      status: "reserved" as const,
      price: null,
      image: null,
    };
    const [apartment, hidden] = apartmentNodes(input);
    expect(apartment).toMatchObject({
      "@type": "Apartment",
      numberOfRooms: 1,
      floorSize: { "@type": "QuantitativeValue", value: 62.09, unitCode: "MTK" },
    });
    expect(hidden).toMatchObject({
      "@type": "Offer",
      availability: "https://schema.org/Reserved",
    });
    expect(hidden).not.toHaveProperty("price");
    const [, priced] = apartmentNodes({
      ...input,
      status: "available",
      price: { amount: "9500000", currency: "AZN" },
    });
    expect(priced).toMatchObject({
      availability: "https://schema.org/InStock",
      price: "95000.00",
      priceCurrency: "AZN",
    });
  });

  it("numbers breadcrumbs from 1", () => {
    const node = breadcrumbNode([
      { name: "Kalbajar City", url: origin },
      { name: "Mənzillər", url: `${origin}/menziller` },
    ]);
    expect(node.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Kalbajar City", item: origin },
      { "@type": "ListItem", position: 2, name: "Mənzillər", item: `${origin}/menziller` },
    ]);
  });

  it("builds a NewsArticle with the fields Google requires", () => {
    const node = newsArticleNode({
      origin,
      url: `${origin}/xeberler/x`,
      headline: "x".repeat(130),
      description: null,
      datePublished: "2026-10-01T09:00:00.000Z",
      dateModified: "2026-10-02T09:00:00.000Z",
      images: [null, `${origin}/xeberler/x/opengraph-image`],
      author: { name: "InCity Projects", url: origin },
    });
    expect((node.headline as string).length).toBeLessThanOrEqual(110);
    expect(node.image).toEqual([`${origin}/xeberler/x/opengraph-image`]);
    expect(node.author).toEqual([
      { "@type": "Organization", name: "InCity Projects", url: origin },
    ]);
    expect(node).not.toHaveProperty("description");
  });
});

describe("sitemaps", () => {
  const data: SitemapData = {
    apartments: [{ slug: "blok-a-menzil-101", updatedAt: "2026-10-05T00:00:00.000Z" }],
    roomCounts: [{ rooms: 2, updatedAt: "2026-10-04T00:00:00.000Z" }],
    news: [{ slug: "ilk-xeber", updatedAt: "2026-10-06T00:00:00.000Z" }],
    settingsUpdatedAt: "2026-10-01T00:00:00.000Z",
    homeUpdatedAt: "2026-10-02T00:00:00.000Z",
    constructionUpdatedAt: null,
    galleryUpdatedAt: null,
    noindex: ["/elaqe"],
  };

  it("lists indexable pages with lastmod and alternates, without noindex ones", () => {
    const entries = sitemapEntries(data, "ru", origin);
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`${origin}/ru`);
    expect(urls).toContain(`${origin}/ru/menziller?otaq=2`);
    expect(urls).toContain(`${origin}/ru/menziller/blok-a-menzil-101`);
    expect(urls).toContain(`${origin}/ru/xeberler/ilk-xeber`);
    expect(urls).not.toContain(`${origin}/ru/elaqe`);
    expect(urls).not.toContain(`${origin}/ru/kompleks`);
    expect(urls.some((url) => url.includes("primitivler"))).toBe(false);

    const home = entries.find((entry) => entry.url === `${origin}/ru`);
    expect(home?.lastModified).toBe("2026-10-02T00:00:00.000Z");
    expect(home?.languages["x-default"]).toBe(origin);
    expect(entries.find((entry) => entry.url.endsWith("/tikinti"))).not.toHaveProperty(
      "lastModified",
    );
  });

  it("covers every indexable route in routing.ts", () => {
    const listed = new Set(
      sitemapEntries({ ...data, noindex: [] }, "az", origin).map(
        (entry) => new URL(entry.url).pathname,
      ),
    );
    const placeholders = ["/kompleks", "/primitivler", "/primitivler/hereket"];
    for (const route of Object.keys(pathnames)) {
      if (placeholders.includes(route)) continue;
      const sample = route.replace(
        "[slug]",
        route.startsWith("/xeberler") ? "ilk-xeber" : "blok-a-menzil-101",
      );
      expect(listed, route).toContain(sample);
    }
  });

  it("writes escaped XML with an xhtml:link per locale, and the index", () => {
    const xml = sitemapXml([{ url: `${origin}/menziller?otaq=2&x=1`, languages: { az: origin } }]);
    expect(xml).toContain("<loc>https://kalbajarcity.com/menziller?otaq=2&#38;x=1</loc>");
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="az"');
    expect(sitemapIndexXml(origin)).toContain(`<loc>${origin}/sitemap/en.xml</loc>`);
  });
});

describe("legacy redirects", () => {
  it("maps old paths to existing routes, never to themselves", () => {
    const routes = new Set(Object.keys(pathnames));
    for (const { from, to } of legacyRedirects) {
      expect(from).toMatch(/^\//);
      expect(from).not.toBe(to);
      expect(routes, to).toContain(to);
    }
    expect(legacyRedirects).toContainEqual({ from: "/laq", to: "/elaqe" });
  });
});

describe("Open Graph palette", () => {
  it("reads the card colours from the token file", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
      "utf8",
    );
    const palette = parsePalette(css);
    for (const value of Object.values(palette)) expect(value).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
