import { getPathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { privacy } from "@/config/privacy";

import { languageAlternates, overrideKey, type PageHref } from "./metadata";
import { absoluteUrl } from "./url";

/** What the sitemaps list; timestamps are ISO strings, null when nothing is stored yet. */
export type SitemapData = {
  /** Apartments on the public site (available, reserved, sold). */
  apartments: Array<{ slug: string; updatedAt: string | null }>;
  /** Room counts with public apartments: each is a landing view, `/menziller?otaq=N`. */
  roomCounts: Array<{ rooms: number; updatedAt: string | null }>;
  /** Published articles. */
  news: Array<{ slug: string; updatedAt: string | null }>;
  settingsUpdatedAt: string | null;
  homeUpdatedAt: string | null;
  constructionUpdatedAt: string | null;
  galleryUpdatedAt: string | null;
  /** Paths the console marked noindex (`seo_overrides`). */
  noindex: string[];
};

/** One URL of a sitemap: where it is, when it changed, and the same page in every locale. */
export type SitemapEntry = {
  url: string;
  lastModified?: string;
  /** hreflang → absolute URL, `x-default` included. */
  languages: Record<string, string>;
};

/** The per-locale sitemaps, as `/sitemap/<locale>.xml`. */
export const sitemapIds: readonly Locale[] = locales;

export const sitemapPath = (id: Locale) => `/sitemap/${id}.xml`;

function newest(...dates: Array<string | null | undefined>): string | null {
  const present = dates.filter((date): date is string => !!date).sort();
  return present.at(-1) ?? null;
}

/**
 * Every indexable page in one locale, with `lastmod` from the data and its
 * alternates in every locale. Left out: views of a page (filters other than
 * a single room count, later pages, gallery categories), placeholders
 * (none at present), development fixtures, and whatever the console
 * marked noindex.
 */
export function sitemapEntries(data: SitemapData, locale: Locale, origin: string): SitemapEntry[] {
  const apartmentsUpdatedAt = newest(...data.apartments.map((item) => item.updatedAt));
  const newsUpdatedAt = newest(...data.news.map((item) => item.updatedAt));
  const pages: Array<{ href: PageHref; lastModified: string | null }> = [
    { href: "/", lastModified: newest(data.homeUpdatedAt, data.settingsUpdatedAt) },
    { href: "/menziller", lastModified: apartmentsUpdatedAt },
    ...data.roomCounts.map(({ rooms, updatedAt }) => ({
      href: { pathname: "/menziller", query: { otaq: String(rooms) } } as PageHref,
      lastModified: updatedAt,
    })),
    ...data.apartments.map(({ slug, updatedAt }) => ({
      href: { pathname: "/menziller/[slug]", params: { slug } } as PageHref,
      lastModified: updatedAt,
    })),
    { href: "/kompleks", lastModified: apartmentsUpdatedAt },
    { href: "/haqqimizda", lastModified: newest(data.homeUpdatedAt, data.settingsUpdatedAt) },
    { href: "/yerlesme", lastModified: newest(data.homeUpdatedAt, data.settingsUpdatedAt) },
    { href: "/tikinti", lastModified: data.constructionUpdatedAt },
    { href: "/qalereya", lastModified: data.galleryUpdatedAt },
    { href: "/xeberler", lastModified: newsUpdatedAt },
    ...data.news.map(({ slug, updatedAt }) => ({
      href: { pathname: "/xeberler/[slug]", params: { slug } } as PageHref,
      lastModified: updatedAt,
    })),
    { href: "/elaqe", lastModified: data.settingsUpdatedAt },
    { href: "/mexfilik-siyaseti", lastModified: `${privacy.updated}T00:00:00.000Z` },
  ];

  const hidden = new Set(data.noindex);
  return pages
    .filter((page) => !hidden.has(overrideKey(page.href)))
    .map((page) => ({
      url: absoluteUrl(getPathname({ href: page.href, locale }), origin),
      ...(page.lastModified && { lastModified: page.lastModified }),
      languages: languageAlternates(page.href, origin),
    }));
}

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** A `<urlset>` with an `xhtml:link` alternate per locale for every URL. */
export function sitemapXml(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lines = [`<loc>${escapeXml(entry.url)}</loc>`];
    if (entry.lastModified) lines.push(`<lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
    for (const [hreflang, href] of Object.entries(entry.languages)) {
      lines.push(
        `<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
      );
    }
    return ["<url>", ...lines.map((line) => `  ${line}`), "</url>"].join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

/** The sitemap index robots.txt points at: one sitemap per locale. */
export function sitemapIndexXml(origin: string): string {
  const sitemaps = sitemapIds.map(
    (id) => `<sitemap><loc>${escapeXml(absoluteUrl(sitemapPath(id), origin))}</loc></sitemap>`,
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...sitemaps,
    `</sitemapindex>`,
    "",
  ].join("\n");
}
