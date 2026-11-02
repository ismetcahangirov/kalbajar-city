import "server-only";

import { eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { contacts as fallbackContacts } from "@/config/contacts";
import { privacy } from "@/config/privacy";
import { getDb } from "@/db";
import type { Executor } from "@/db/client";
import { homeSections, media, settings } from "@/db/schema";
import { localize, type Localized, type Translatable } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import type { ComplexFacts } from "@/lib/facts";
import { homeSectionContentSchemas, type HomeSectionContentByKey } from "@/shared/home-sections";
import { settingsSchemas, type SettingsKey, type SettingsValue } from "@/shared/settings";

import type { Amenity } from "./home";
import { toPublicImage, type PublicImage } from "./media";

export type Coordinates = NonNullable<SettingsValue<"contacts">["coordinates"]>;

/** What the contact page and the map need: one source for every page that shows contacts. */
export type SiteContacts = {
  /** E.164; the first is the main line. */
  phones: string[];
  whatsapp: string | null;
  email: string | null;
  address: Localized | null;
  hours: Localized | null;
  /** Null until the owner confirms them (#7); no map is shown without them. */
  coordinates: Coordinates | null;
  socials: SettingsValue<"socials">;
};

export type AboutPage = {
  /** The home page's about section, so the console edits that copy in one place. */
  intro: {
    eyebrow: Localized | null;
    title: Localized;
    body: Localized;
    image: PublicImage | null;
  } | null;
  amenities: Array<{ icon: Amenity; title: Localized; body: Localized | null }>;
  facts: ComplexFacts | null;
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
  const [contacts, socials] = await Promise.all([
    readSetting(db, "contacts"),
    readSetting(db, "socials"),
  ]);
  const maybe = (field: Translatable | null | undefined) =>
    field ? localize(field, locale) : null;
  return {
    phones: contacts?.phones ?? [...fallbackContacts.phones],
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
  };
}

/** The developer, for the `Organization` every page publishes as structured data. */
export async function getDeveloper(): Promise<SettingsValue<"developer">> {
  "use cache";
  cacheTag(publicTags.settings);
  cacheLife("days");

  return (await readSetting(getDb(), "developer")) ?? fallbackDeveloper;
}

/** The about page: the home about copy, the amenities, the facts and the developer. */
export async function getAboutPage(locale: Locale): Promise<AboutPage> {
  "use cache";
  cacheTag(publicTags.settings, publicTags.content, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [complex, developer, about] = await Promise.all([
    readSetting(db, "complex"),
    readSetting(db, "developer"),
    readSection(db, "about"),
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
          image: image ?? null,
        }
      : null,
    amenities: amenities.map((item) => ({
      icon: item.icon,
      title: text(item.title),
      body: maybe(item.body),
    })),
    facts: complex ? (facts as ComplexFacts) : null,
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
