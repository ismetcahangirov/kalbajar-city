import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { contacts as fallbackContacts } from "@/config/contacts";
import { privacy } from "@/config/privacy";
import { defaultImage } from "@/content/defaults";
import { getDb } from "@/db";
import type { Executor } from "@/db/client";
import { homeSections, layoutTypes, media, settings } from "@/db/schema";
import { localize, type Localized, type Translatable } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { layoutFacts, type ComplexFacts, type LayoutFacts } from "@/lib/facts";
import { homeSectionContentSchemas, type HomeSectionContentByKey } from "@/shared/home-sections";
import { settingsSchemas, type SettingsKey, type SettingsValue } from "@/shared/settings";

import type { Amenity } from "./home";
import { toPublicImage, type PublicImage } from "./media";

export type Coordinates = NonNullable<SettingsValue<"contacts">["coordinates"]>;

/** What the contact page and the map need: one source for every page that shows contacts. */
export type SiteContacts = {
  /** E.164; the first is the main line. */
  phones: string[];
  /** The main line, which the call buttons in the header and menu dial. */
  mainPhone: string;
  whatsapp: string | null;
  email: string | null;
  address: Localized | null;
  hours: Localized | null;
  /** Null until the owner confirms them (#7); no map is shown without them. */
  coordinates: Coordinates | null;
  socials: SettingsValue<"socials">;
  /**
   * The fields above that still hold a seeded stand-in (`settings.placeholders`,
   * #27). Pages show them, as the owner chose; machine-readable output leaves
   * them out (`confirmedContacts`).
   */
  standIns: ContactStandIn[];
};

/** The contact fields that can hold a stand-in, as named in a `contacts.*` placeholder path. */
export const contactStandInFields = [
  "whatsapp",
  "email",
  "address",
  "hours",
  "coordinates",
] as const;

export type ContactStandIn = (typeof contactStandInFields)[number];

export type AboutPage = {
  /** The home page's about section, so the console edits that copy in one place. */
  intro: {
    eyebrow: Localized | null;
    title: Localized;
    body: Localized;
    image: PublicImage;
  } | null;
  amenities: Array<{ icon: Amenity; title: Localized; body: Localized | null }>;
  facts: ComplexFacts | null;
  /** The layout types' room counts and area range; null while none is listed. */
  layouts: LayoutFacts | null;
  /** The address in the page's locale, from the contacts settings; null while unset. */
  address: string | null;
  developer: SettingsValue<"developer">;
};

export type LocationPage = {
  /** The home page's location section: its copy, map image and distances. */
  body: Localized | null;
  directions: Localized | null;
  map: PublicImage | null;
  distances: Array<{ place: Localized; minutes: number }>;
};

/** The developer as the footer has always named it, until the settings row says otherwise. */
const fallbackDeveloper: SettingsValue<"developer"> = {
  name: "InCity Projects",
  instagram: null,
  website: null,
};

/**
 * Contacts and socials from `settings`. Until the console (#27) has written a
 * valid row, the values the shell uses (`src/config/contacts.ts`) stand in.
 */
export async function getSiteContacts(locale: Locale): Promise<SiteContacts> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("days");

  const db = getDb();
  const [contacts, socials, placeholders] = await Promise.all([
    readSetting(db, "contacts"),
    readSetting(db, "socials"),
    readSetting(db, "placeholders"),
  ]);
  const flagged = new Set(placeholders?.paths ?? []);
  const maybe = (field: Translatable | null | undefined) =>
    field ? localize(field, locale) : null;
  const phones = contacts?.phones.length ? contacts.phones : [...fallbackContacts.phones];
  return {
    phones,
    mainPhone: phones[0] ?? fallbackContacts.phones[0],
    whatsapp: contacts ? contacts.whatsapp : fallbackContacts.whatsapp,
    email: contacts?.email ?? null,
    address: maybe(contacts?.address),
    hours: maybe(contacts?.hours),
    coordinates: contacts?.coordinates ?? null,
    socials: socials ?? {
      instagram: fallbackContacts.instagram,
      facebook: null,
      youtube: null,
      tiktok: null,
    },
    standIns: contactStandInFields.filter((field) => flagged.has(`contacts.${field}`)),
  };
}

export type Developer = SettingsValue<"developer"> & {
  /** The logo's public URL, once the owner has chosen one in the console (#27). */
  logo: string | null;
};

/** The developer, for the `Organization` every page publishes as structured data. */
export async function getDeveloper(): Promise<Developer> {
  "use cache";
  cacheTag(publicTags.settings, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const developer = (await readSetting(db, "developer")) ?? fallbackDeveloper;
  const [logo] = await images(db, [developer.logoMediaId], "az");
  return { ...developer, logo: logo?.src ?? null };
}

/**
 * The about page: the home about copy, the amenities, the facts and the
 * developer. The facts also feed `llms.txt`, so both say the same thing.
 */
export async function getAboutPage(locale: Locale): Promise<AboutPage> {
  "use cache";
  cacheTag(publicTags.settings, publicTags.content, publicTags.media, publicTags.inventory);
  cacheLife("days");

  const db = getDb();
  const [complex, developer, contacts, about, layouts] = await Promise.all([
    readSetting(db, "complex"),
    readSetting(db, "developer"),
    readSetting(db, "contacts"),
    readSection(db, "about"),
    db
      .select({ rooms: layoutTypes.rooms, areaTotal: layoutTypes.areaTotal })
      .from(layoutTypes)
      .orderBy(asc(layoutTypes.rooms)),
  ]);
  const text = (field: Translatable) => localize(field, locale);
  const maybe = (field: Translatable | null | undefined) => (field ? text(field) : null);
  const [image] = await images(db, [about?.mediaId], locale);

  const { amenities = [], ...facts } = complex ?? {};
  return {
    intro: about
      ? {
          eyebrow: maybe(about.eyebrow),
          title: text(about.title),
          body: text(about.body),
          image: image ?? defaultImage("home.about.image", locale),
        }
      : null,
    amenities: amenities.map((item) => ({
      icon: item.icon,
      title: text(item.title),
      body: maybe(item.body),
    })),
    facts: complex ? (facts as ComplexFacts) : null,
    layouts: layoutFacts(layouts),
    address: contacts?.address ? text(contacts.address).value : null,
    developer: developer ?? fallbackDeveloper,
  };
}

/**
 * The location page's copy, distances and static map, from the home page's
 * location section whether or not the home page shows it.
 */
export async function getLocationPage(locale: Locale): Promise<LocationPage> {
  "use cache";
  cacheTag(publicTags.content, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const location = await readSection(db, "location");
  const maybe = (field: Translatable | null | undefined) =>
    field ? localize(field, locale) : null;
  const [map] = await images(db, [location?.mapMediaId], locale);
  return {
    body: maybe(location?.body),
    directions: maybe(location?.directions),
    map: map ?? null,
    distances: (location?.distances ?? []).map((d) => ({
      place: localize(d.place, locale),
      minutes: d.minutes,
    })),
  };
}

/**
 * How many months the privacy notice says leads are kept: the period the
 * retention job applies (`settings.leads`, set in the console), or the
 * notice's own figure until that row exists.
 */
export async function getLeadRetentionMonths(): Promise<number> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("days");

  const leads = await readSetting(getDb(), "leads");
  return leads?.retentionMonths ?? privacy.retentionMonths;
}

export type AnalyticsIds = { googleAnalyticsId: string | null; metaPixelId: string | null };

/** A GA4 measurement ID (`G-XXXXXXX`) and a Meta Pixel ID (digits only). */
const idFormats = {
  googleAnalyticsId: /^G-[A-Z0-9]{4,20}$/,
  metaPixelId: /^\d{5,20}$/,
} as const;

/**
 * The analytics IDs the console saved (`settings.analytics`, #29). An ID that
 * is not in its service's format is ignored rather than put into a script.
 */
export async function getAnalyticsIds(): Promise<AnalyticsIds> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("days");

  const analytics = await readSetting(getDb(), "analytics");
  const valid = (key: keyof AnalyticsIds) => {
    const value = analytics?.[key]?.trim().toUpperCase();
    return value && idFormats[key].test(value) ? value : null;
  };
  return { googleAnalyticsId: valid("googleAnalyticsId"), metaPixelId: valid("metaPixelId") };
}

/** A settings value, or null when the row is missing or no longer matches its schema. */
async function readSetting<K extends SettingsKey>(
  db: Executor,
  key: K,
): Promise<SettingsValue<K> | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  const parsed = settingsSchemas[key].safeParse(row?.value);
  return parsed.success ? (parsed.data as SettingsValue<K>) : null;
}

/**
 * A home section's content, or null when the row is missing (the seed writes
 * every section) or no longer matches its schema: the page then leaves that
 * block out instead of failing.
 */
async function readSection<K extends "about" | "location">(
  db: Executor,
  key: K,
): Promise<HomeSectionContentByKey[K] | null> {
  const [row] = await db.select().from(homeSections).where(eq(homeSections.key, key));
  const parsed = homeSectionContentSchemas[key].safeParse(row?.content);
  return parsed.success ? (parsed.data as HomeSectionContentByKey[K]) : null;
}

/** Public images for media ids, in order; null for a missing id or an unpublishable file. */
async function images(
  db: Executor,
  ids: Array<string | null | undefined>,
  locale: Locale,
): Promise<Array<PublicImage | null>> {
  const wanted = ids.filter((id): id is string => !!id);
  if (!wanted.length) return ids.map(() => null);
  const rows = await db.select().from(media).where(inArray(media.id, wanted));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => (id ? toPublicImage(byId.get(id), locale) : null));
}
