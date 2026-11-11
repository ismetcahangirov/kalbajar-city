import { afterEach, describe, expect, it, vi } from "vitest";

import { siteIndexable } from "@/lib/seo/indexing";
import { buildPageMetadata, type PageSeo, type SeoContext } from "@/lib/seo/metadata";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { default: robots } = await import("@/app/robots");

const origin = "https://staging.kalbajarcity.com";
const context: SeoContext = { origin, siteName: "Kalbajar City", override: null };
const page: PageSeo = { locale: "az", href: "/haqqimizda", title: "Haqqımızda" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SITE_NOINDEX", () => {
  it("leaves the site indexable when unset or empty", () => {
    expect(siteIndexable({})).toBe(true);
    expect(siteIndexable({ SITE_NOINDEX: "" })).toBe(true);
    expect(siteIndexable({ SITE_NOINDEX: "false" })).toBe(true);
    expect(siteIndexable({ SITE_NOINDEX: "0" })).toBe(true);
  });

  it("hides the site when set", () => {
    expect(siteIndexable({ SITE_NOINDEX: "true" })).toBe(false);
    expect(siteIndexable({ SITE_NOINDEX: "1" })).toBe(false);
    expect(siteIndexable({ SITE_NOINDEX: " true " })).toBe(false);
  });

  it("rejects any other value instead of guessing", () => {
    expect(() => siteIndexable({ SITE_NOINDEX: "yes" })).toThrow(/SITE_NOINDEX/);
    expect(() => siteIndexable({ SITE_NOINDEX: "TRUE" })).toThrow(/SITE_NOINDEX/);
  });

  it("reads the process environment at call time", () => {
    vi.stubEnv("SITE_NOINDEX", "true");
    expect(siteIndexable()).toBe(false);
    vi.stubEnv("SITE_NOINDEX", "");
    expect(siteIndexable()).toBe(true);
  });
});

describe("robots.txt", () => {
  it("opens the public site and names the sitemap in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kalbajarcity.com");
    vi.stubEnv("SITE_NOINDEX", "");
    const result = await robots();
    expect(result.sitemap).toBe("https://kalbajarcity.com/sitemap.xml");
    expect(result.rules).toContainEqual(
      expect.objectContaining({ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }),
    );
  });

  it("disallows everything and names no sitemap on staging", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
    vi.stubEnv("SITE_NOINDEX", "true");
    expect(await robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
});

describe("page metadata on a hidden site", () => {
  it("makes every page noindex, nofollow, even one the console leaves indexable", () => {
    const metadata = buildPageMetadata(page, { ...context, siteNoindex: true });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toEqual({ canonical: `${origin}/haqqimizda` });
  });

  it("changes nothing when the site is indexable", () => {
    expect(buildPageMetadata(page, { ...context, siteNoindex: false }).robots).toBeUndefined();
  });
});
