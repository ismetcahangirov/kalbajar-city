import type { PublicApartmentStatus } from "@/shared/apartments";

/**
 * Typed builders for the site's schema.org JSON-LD (spec §6). Every value
 * comes from the database, the settings or the catalogues; a property whose
 * value is unknown is left out rather than guessed.
 */

export type JsonLdNode = { "@type": string; "@id"?: string } & Record<string, unknown>;

export type JsonLdGraph = { "@context": "https://schema.org"; "@graph": JsonLdNode[] };

type Ref = { "@id": string };

/** Drops null, undefined, empty strings and empty arrays, so absent facts leave no trace. */
function compact<T extends Record<string, unknown>>(node: T): T {
  return Object.fromEntries(
    Object.entries(node).filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0),
    ),
  ) as T;
}

/** One document per page: the nodes in a single `@graph`. */
export function jsonLdGraph(nodes: Array<JsonLdNode | null | undefined>): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter((node): node is JsonLdNode => !!node),
  };
}

/**
 * The graph as the text of a `<script type="application/ld+json">`. `<` is
 * escaped, so no value can close the script element.
 */
export function serializeJsonLd(data: JsonLdGraph): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const organizationId = (origin: string) => `${origin}/#organization`;
export const complexId = (origin: string) => `${origin}/#complex`;

export type OrganizationInput = {
  origin: string;
  /** The developer's name (`settings.developer`). */
  name: string;
  /** The developer's own website; the site itself when there is none. */
  website: string | null;
  /** Profiles: the developer's and the complex's social accounts. */
  sameAs: Array<string | null>;
  /** E.164, main line first. */
  phones: string[];
  email: string | null;
  /** The logo's absolute URL, once chosen in the console (#27). */
  logo?: string | null;
};

/**
 * The developer, on every page. `logo` only once the owner has chosen the
 * logo in the console's settings (#27): there is no stand-in.
 */
export function organizationNode(input: OrganizationInput): JsonLdNode {
  const url = input.website ?? `${input.origin}/`;
  const sameAs = [...new Set(input.sameAs.filter((link): link is string => !!link))].filter(
    (link) => link !== url,
  );
  return compact({
    "@type": "Organization",
    "@id": organizationId(input.origin),
    name: input.name,
    url,
    logo: input.logo,
    email: input.email,
    sameAs,
    contactPoint: input.phones.map((telephone) => ({
      "@type": "ContactPoint",
      contactType: "sales",
      telephone,
    })),
  });
}

export type ComplexInput = {
  origin: string;
  /** The home page in the current locale. */
  url: string;
  name: string;
  description: string | null;
  /** Free text from `settings.contacts.address`; null until the owner sets it (#7). */
  address: string | null;
  /** The main line, E.164: the same number the site's call buttons dial. */
  telephone: string | null;
  coordinates: { lat: number; lng: number } | null;
  apartments: number | null;
  amenities: string[];
};

/** The complex itself, on home and `/haqqimizda`. */
export function apartmentComplexNode(input: ComplexInput): JsonLdNode {
  return compact({
    "@type": "ApartmentComplex",
    "@id": complexId(input.origin),
    name: input.name,
    url: input.url,
    description: input.description,
    address: input.address
      ? { "@type": "PostalAddress", streetAddress: input.address, addressCountry: "AZ" }
      : null,
    telephone: input.telephone,
    geo: input.coordinates
      ? {
          "@type": "GeoCoordinates",
          latitude: input.coordinates.lat,
          longitude: input.coordinates.lng,
        }
      : null,
    numberOfAccommodationUnits:
      input.apartments !== null ? { "@type": "QuantitativeValue", value: input.apartments } : null,
    amenityFeature: input.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
  });
}

const availability: Record<PublicApartmentStatus, string> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/Reserved",
  sold: "https://schema.org/SoldOut",
};

/** A price in minor units ("12345600") as schema.org wants it ("123456.00"). */
export function priceFromMinor(amount: string): string {
  const digits = amount.replace(/^-/, "").padStart(3, "0");
  const sign = amount.startsWith("-") ? "-" : "";
  return `${sign}${digits.slice(0, -2).replace(/^0+(?=\d)/, "")}.${digits.slice(-2)}`;
}

export type ApartmentInput = {
  origin: string;
  url: string;
  name: string;
  rooms: number;
  /** m². */
  area: number;
  floor: number;
  status: PublicApartmentStatus;
  /** Only while prices are public (`settings.prices.visible`). */
  price: { amount: string; currency: string } | null;
  /** The floor plan. */
  image: string | null;
};

/** The apartment, and the offer to sell it: price only when public, availability from the status. */
export function apartmentNodes(input: ApartmentInput): [JsonLdNode, JsonLdNode] {
  const id = `${input.url}#apartment`;
  const apartment = compact({
    "@type": "Apartment",
    "@id": id,
    name: input.name,
    url: input.url,
    numberOfRooms: input.rooms,
    floorSize: { "@type": "QuantitativeValue", value: input.area, unitCode: "MTK" },
    floorLevel: String(input.floor),
    image: input.image,
    containedInPlace: { "@id": complexId(input.origin) } satisfies Ref,
  });
  const offer = compact({
    "@type": "Offer",
    "@id": `${input.url}#offer`,
    url: input.url,
    itemOffered: { "@id": id } satisfies Ref,
    availability: availability[input.status],
    price: input.price ? priceFromMinor(input.price.amount) : null,
    priceCurrency: input.price?.currency ?? null,
    seller: { "@id": organizationId(input.origin) } satisfies Ref,
  });
  return [apartment, offer];
}

/** Home, then each level down to the page itself; absolute URLs. */
export function breadcrumbNode(items: Array<{ name: string; url: string }>): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** The questions and answers the home page shows, word for word. */
export function faqNode(items: Array<{ question: string; answer: string }>): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export type ArticleInput = {
  origin: string;
  url: string;
  headline: string;
  description: string | null;
  /** ISO timestamps. */
  datePublished: string;
  dateModified: string;
  /** The cover image first, then the generated card. */
  images: Array<string | null>;
  /** The developer, who publishes the news. */
  author: { name: string; url: string };
};

/** Google truncates longer headlines in rich results. */
const headlineLimit = 110;

export function newsArticleNode(input: ArticleInput): JsonLdNode {
  const headline =
    input.headline.length > headlineLimit
      ? `${input.headline.slice(0, headlineLimit - 1).trimEnd()}…`
      : input.headline;
  return compact({
    "@type": "NewsArticle",
    "@id": `${input.url}#article`,
    headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    image: input.images.filter((image): image is string => !!image),
    author: [{ "@type": "Organization", name: input.author.name, url: input.author.url }],
    publisher: { "@id": organizationId(input.origin) } satisfies Ref,
  });
}
