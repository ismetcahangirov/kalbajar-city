import type { Metadata } from "next";

import { getPathname } from "@/i18n/navigation";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";

import { absoluteUrl } from "./url";

/** A public page's address, as `Link` and `getPathname` take it. */
export type PageHref = Parameters<typeof getPathname>[0]["href"];

/** What the console (#27) may override for one path, in the page's own locale. */
export type SeoOverride = {
  /** Used as the whole title, without the site-name template. */
  title: string | null;
  description: string | null;
  noindex: boolean;
  /** An absolute image URL from the media library. */
  image: string | null;
};

export type PageSeo = {
  locale: Locale;
  /**
   * The page's own address, which is its canonical URL. A view of a page
   * (filters, a later page of a list) passes the page it is a view of and
   * `indexable: false`.
   */
  href: PageHref;
  title: string;
  /** The home page: the title stands alone, without the site-name template. */
  absoluteTitle?: boolean;
  description?: string | null;
  /** False for views of a page: `noindex, follow`, canonical to `href`. */
  indexable?: boolean;
  /**
   * `own`: the page has its own `opengraph-image` route (apartments,
   * articles). Otherwise the locale's site image is used.
   */
  image?: "own" | "site";
  article?: { publishedTime: string; modifiedTime?: string };
  /** Extra `<meta name>` tags, such as `geo.position` and `ICBM`. */
  other?: Record<string, string>;
};

export type SeoContext = {
  origin: string;
  siteName: string;
  override: SeoOverride | null;
};

/** Open Graph locale codes. */
const ogLocales: Record<Locale, string> = { az: "az_AZ", en: "en_US", ru: "ru_RU" };

/** The generated images are this size (`src/lib/seo/og.tsx`). */
export const ogImageSize = { width: 1200, height: 630 } as const;

/** The page's path in every locale; Azerbaijani has no prefix. */
export function localizedPaths(href: PageHref): Record<Locale, string> {
  return Object.fromEntries(
    locales.map((locale) => [locale, getPathname({ href, locale })]),
  ) as Record<Locale, string>;
}

/**
 * The path `seo_overrides` keys a page by: the Azerbaijani path without a
 * locale prefix, with its query when the page is a query view of its own
 * (`/menziller?otaq=2`).
 */
export function overrideKey(href: PageHref): string {
  return getPathname({ href, locale: defaultLocale });
}

/**
 * `hreflang` alternates for every locale, and `x-default` pointing at the
 * Azerbaijani page, as absolute URLs.
 */
export function languageAlternates(href: PageHref, origin: string): Record<string, string> {
  const paths = localizedPaths(href);
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[locale] = absoluteUrl(paths[locale], origin);
  languages["x-default"] = absoluteUrl(paths[defaultLocale], origin);
  return languages;
}

/**
 * The complex's region as ISO 3166-2: Kalbajar District, Azerbaijan. A fact
 * about where the complex stands, not an owner decision.
 */
export const geoRegion = "AZ-KAL";

/**
 * Local-search meta (spec §6, #29): `geo.region` and `geo.placename` on every
 * page, and `geo.position` and `ICBM` only once the owner has confirmed the
 * coordinates (#7).
 */
export function geoMeta(
  coordinates: { lat: number; lng: number } | null,
  placename: string,
): Record<string, string> {
  return {
    "geo.region": geoRegion,
    "geo.placename": placename,
    ...(coordinates && {
      "geo.position": `${coordinates.lat};${coordinates.lng}`,
      ICBM: `${coordinates.lat}, ${coordinates.lng}`,
    }),
  };
}

/** The `opengraph-image` route below a path. */
function imagePath(path: string): string {
  return `${path.replace(/\/$/, "")}/opengraph-image`;
}

/**
 * A public page's metadata: title and description from the catalogue or the
 * entity, then the console's overrides; one canonical (the page's own URL in
 * its locale) and, on indexable pages, the full `hreflang` set; Open Graph
 * and Twitter cards with the page's or the site's generated image.
 */
export function buildPageMetadata(page: PageSeo, context: SeoContext): Metadata {
  const { origin, siteName, override } = context;
  const paths = localizedPaths(page.href);
  const canonical = absoluteUrl(paths[page.locale], origin);
  const indexable = page.indexable !== false && !override?.noindex;

  const title = override?.title ?? page.title;
  const description = override?.description ?? page.description ?? undefined;
  const imageUrl =
    override?.image ??
    absoluteUrl(
      imagePath(
        page.image === "own" ? paths[page.locale] : getPathname({ href: "/", locale: page.locale }),
      ),
      origin,
    );
  const generated = !override?.image;

  return {
    title: override?.title || page.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: indexable
      ? { canonical, languages: languageAlternates(page.href, origin) }
      : { canonical },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: {
      type: page.article ? "article" : "website",
      siteName,
      title,
      description,
      url: canonical,
      locale: ogLocales[page.locale],
      alternateLocale: locales.filter((l) => l !== page.locale).map((l) => ogLocales[l]),
      images: [
        generated ? { url: imageUrl, ...ogImageSize, alt: title } : { url: imageUrl, alt: title },
      ],
      ...(page.article && {
        publishedTime: page.article.publishedTime,
        modifiedTime: page.article.modifiedTime,
      }),
    },
    // The image, title and description come from Open Graph.
    twitter: { card: "summary_large_image" },
    ...(page.other && { other: page.other }),
  };
}

/**
 * The search engines' ownership meta tags (#28, #29): Google's through the
 * Metadata API's `google` field, Bing's `msvalidate.01` through `other`.
 * Nothing at all while neither token is set.
 */
export function verificationMetadata(tokens: {
  google: string | null;
  bing: string | null;
}): Metadata["verification"] {
  if (!tokens.google && !tokens.bing) return undefined;
  return {
    ...(tokens.google && { google: tokens.google }),
    ...(tokens.bing && { other: { "msvalidate.01": tokens.bing } }),
  };
}
