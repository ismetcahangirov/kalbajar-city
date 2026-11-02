import "server-only";

import { getTranslations } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAboutPage, getDeveloper, getSiteContacts } from "@/lib/public/site";
import {
  apartmentComplexNode,
  breadcrumbNode,
  jsonLdGraph,
  organizationNode,
  serializeJsonLd,
  type JsonLdNode,
} from "@/lib/seo/json-ld";
import type { PageHref } from "@/lib/seo/metadata";
import { absoluteUrl, siteOrigin } from "@/lib/seo/url";

/**
 * The page's one `<script type="application/ld+json">`: the developer's
 * `Organization`, which every page carries, then the page's own nodes.
 */
export async function StructuredData({
  locale,
  nodes = [],
}: {
  locale: Locale;
  nodes?: Array<JsonLdNode | null>;
}) {
  const [contacts, developer] = await Promise.all([getSiteContacts(locale), getDeveloper()]);
  const { socials } = contacts;
  const organization = organizationNode({
    origin: siteOrigin(),
    name: developer.name,
    website: developer.website,
    sameAs: [
      developer.instagram,
      socials.instagram,
      socials.facebook,
      socials.youtube,
      socials.tiktok,
    ],
    phones: contacts.phones,
    email: contacts.email,
    logo: developer.logo,
  });
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON; serializeJsonLd escapes `<`.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLdGraph([organization, ...nodes])) }}
    />
  );
}

/** A `BreadcrumbList` from the home page down to the current one. */
export async function breadcrumbs(
  locale: Locale,
  trail: Array<{ name: string; href: PageHref }>,
): Promise<JsonLdNode> {
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const origin = siteOrigin();
  return breadcrumbNode(
    [{ name: t("title"), href: "/" as PageHref }, ...trail].map((crumb) => ({
      name: crumb.name,
      url: absoluteUrl(getPathname({ href: crumb.href, locale }), origin),
    })),
  );
}

/**
 * The complex as `ApartmentComplex`. Its address and coordinates appear only
 * once the owner has set them (#7); both are null today.
 */
export async function complexNode(locale: Locale): Promise<JsonLdNode> {
  const [about, contacts, t] = await Promise.all([
    getAboutPage(locale),
    getSiteContacts(locale),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);
  const origin = siteOrigin();
  return apartmentComplexNode({
    origin,
    url: absoluteUrl(getPathname({ href: "/", locale }), origin),
    name: t("title"),
    description: t("description"),
    address: contacts.address?.value ?? null,
    coordinates: contacts.coordinates,
    apartments: about.facts?.apartments ?? null,
    amenities: about.amenities.map((amenity) => amenity.title.value),
  });
}
