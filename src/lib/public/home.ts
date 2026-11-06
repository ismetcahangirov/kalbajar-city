import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { defaultImage, type DefaultSlot } from "@/content/defaults";
import { getDb } from "@/db";
import { settings as seedSettings } from "@/db/seed/data";
import type { Executor } from "@/db/client";
import {
  constructionUpdateMedia,
  constructionUpdates,
  faq,
  homeSections,
  layoutTypes,
  media,
  settings,
} from "@/db/schema";
import { localize, type Localized, type Translatable } from "@/i18n/content";
import type { Unit } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { publicTags } from "@/lib/cache/tags";
import { publicFaqItems } from "@/lib/faq-facts";
import { homeSectionMedia } from "@/shared/home-sections";
import { settingsSchemas, type ComplexFactKey, type SettingsValue } from "@/shared/settings";

import { resolveHomeSections } from "./home-sections";
import { featuredGroups, groupLayouts, type LayoutGroup } from "./layouts";
import { toPublicImage, toPublicVideo, type PublicImage, type PublicVideo } from "./media";
import { withPosters } from "./rich-text";

export type { LayoutGroup };

export type HomeStat = { fact: ComplexFactKey; value: number; unit: Unit | null; label: Localized };

export type Amenity = SettingsValue<"complex">["amenities"][number]["icon"];

export type HomeSection =
  | {
      kind: "hero";
      title: Localized;
      subtitle: Localized | null;
      /** The console's poster, else the film's poster frame, else the bundled default. */
      poster: PublicImage;
      /** The render in the hero's right third: the console's, else the bundled default. */
      panel: PublicImage;
      video: PublicVideo | null;
      /** Spec chips at the hero's foot; null until layouts exist. */
      chips: { apartments: number; roomsMin: number; roomsMax: number; areaMin: number } | null;
    }
  | { kind: "stats"; items: HomeStat[]; background: PublicImage }
  | {
      kind: "about";
      eyebrow: Localized | null;
      title: Localized;
      body: Localized;
      image: PublicImage;
      background: PublicImage;
    }
  | {
      kind: "layouts";
      title: Localized;
      body: Localized | null;
      groups: LayoutGroup[];
      background: PublicImage;
    }
  | {
      kind: "amenities";
      title: Localized;
      window: PublicImage;
      items: Array<{ icon: Amenity; title: Localized; body: Localized | null }>;
    }
  | {
      kind: "card_zoom";
      title: Localized;
      scenes: Array<{ key: string; image: PublicImage; caption: Localized | null }>;
    }
  | {
      kind: "location";
      title: Localized;
      body: Localized | null;
      map: PublicImage | null;
      distances: Array<{ place: Localized; minutes: number }>;
      intro: PublicImage;
      moverLeft: PublicImage;
      moverRight: PublicImage;
      /** At least one; the travel-time cards use them in turn. */
      cards: PublicImage[];
    }
  | {
      kind: "construction";
      title: Localized;
      update: { title: Localized; month: string; progress: number; image: PublicImage };
    }
  | { kind: "process"; title: Localized; steps: Array<{ title: Localized; body: Localized }> }
  | { kind: "faq"; title: Localized; items: Array<{ question: Localized; answer: Localized }> }
  | { kind: "cta"; title: Localized; body: Localized | null; portrait: PublicImage };

const factUnits: Partial<Record<ComplexFactKey, Unit>> = {
  totalArea: "m2",
  residentialArea: "m2",
  nonResidentialArea: "m2",
  landHectares: "ha",
};

/**
 * The published FAQ in the console's order (`faqOrder`), ties included, as
 * stored: placeholders unfilled. Readers output it through `publicFaqItems`.
 */
export async function loadPublishedFaq(db: Executor) {
  return db
    .select()
    .from(faq)
    .where(eq(faq.status, "published"))
    .orderBy(asc(faq.sortOrder), asc(faq.createdAt), asc(faq.id));
}

/** The complex's facts and amenities; the seed's while no valid row is saved. */
async function readComplex(db: Executor): Promise<SettingsValue<"complex">> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "complex"));
  const saved = settingsSchemas.complex.safeParse(row?.value);
  return saved.success ? saved.data : seedSettings.complex;
}

/**
 * The published FAQ in one locale, its placeholders filled from the same facts
 * the home page shows, for readers other than the home page (`llms.txt`).
 * The home page and its `FAQPage` structured data list the same items.
 */
export async function loadPublicFaq(db: Executor, locale: Locale) {
  const [rows, complex, layouts] = await Promise.all([
    loadPublishedFaq(db),
    readComplex(db),
    db.select({ rooms: layoutTypes.rooms, areaTotal: layoutTypes.areaTotal }).from(layoutTypes),
  ]);
  return publicFaqItems(rows, locale, { complex, layouts });
}

/** The card-zoom scenes shown while the console has chosen none (spec §8). */
const defaultScenes = [
  "home.cardZoom.1",
  "home.cardZoom.2",
  "home.cardZoom.3",
  "home.cardZoom.4",
] as const satisfies readonly DefaultSlot[];

/** The travel-time cards shown while the console has chosen none (spec §8). */
const defaultCards = [
  "home.location.card.1",
  "home.location.card.2",
  "home.location.card.3",
  "home.location.card.4",
  "home.location.card.5",
  "home.location.card.6",
] as const satisfies readonly DefaultSlot[];

/**
 * Everything the home page shows, localised, in the console's order, the hero
 * always first. A section the console hides, or one with nothing to show yet
 * (no published construction update, no layouts), is left out. An image slot
 * the console leaves empty shows its bundled default (`src/content/defaults`),
 * and a section or the complex's facts with nothing saved show the seed's
 * text, so a database without settings still renders the whole page.
 */
export async function getHomePage(locale: Locale): Promise<HomeSection[]> {
  "use cache";
  cacheTag(publicTags.content, publicTags.settings, publicTags.inventory, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [sectionRows, complex, layouts, faqRows, [latestUpdate]] = await Promise.all([
    db.select().from(homeSections),
    readComplex(db),
    db.select().from(layoutTypes).orderBy(asc(layoutTypes.rooms), asc(layoutTypes.areaTotal)),
    loadPublishedFaq(db),
    db
      .select()
      .from(constructionUpdates)
      .where(eq(constructionUpdates.status, "published"))
      .orderBy(desc(constructionUpdates.month))
      .limit(1),
  ]);

  const sections = resolveHomeSections(sectionRows).filter((section) => section.visible);

  const updateMedia = latestUpdate
    ? await db
        .select({ mediaId: constructionUpdateMedia.mediaId })
        .from(constructionUpdateMedia)
        .where(eq(constructionUpdateMedia.updateId, latestUpdate.id))
        .orderBy(asc(constructionUpdateMedia.sortOrder))
        .limit(1)
    : [];

  const mediaIds = new Set<string>();
  const want = (id: string | null | undefined) => id && mediaIds.add(id);
  for (const section of sections) {
    const { images, videos } = homeSectionMedia(section);
    [...images, ...videos].forEach(want);
  }
  layouts.forEach((layout) => want(layout.planMediaId));
  updateMedia.forEach((row) => want(row.mediaId));

  const files = await withPosters(
    db,
    new Map(
      mediaIds.size
        ? (
            await db
              .select()
              .from(media)
              .where(inArray(media.id, [...mediaIds]))
          ).map((row) => [row.id, row])
        : [],
    ),
  );
  const image = (id: string | null | undefined) =>
    id ? toPublicImage(files.get(id), locale) : null;
  const video = (id: string | null | undefined) =>
    id ? toPublicVideo(files.get(id), locale, files) : null;
  const text = (field: Translatable) => localize(field, locale);
  const maybe = (field: Translatable | null | undefined) => (field ? text(field) : null);

  const areas = layouts.map((layout) => Number(layout.areaTotal));
  const rooms = layouts.map((layout) => layout.rooms);

  const resolved = sections.map((section): HomeSection | null => {
    switch (section.key) {
      case "hero": {
        const c = section.content;
        return {
          kind: "hero",
          title: text(c.title),
          subtitle: maybe(c.subtitle),
          // Without a poster of its own, the hero shows the film's poster frame.
          poster:
            image(c.posterMediaId) ??
            video(c.videoMediaId)?.poster ??
            defaultImage("home.hero.poster", locale),
          panel: image(c.panelMediaId) ?? defaultImage("home.hero.panel", locale),
          video: video(c.videoMediaId),
          chips: layouts.length
            ? {
                apartments: complex.apartments,
                roomsMin: Math.min(...rooms),
                roomsMax: Math.max(...rooms),
                areaMin: Math.min(...areas),
              }
            : null,
        };
      }
      case "stats":
        return section.content.items.length
          ? {
              kind: "stats",
              items: section.content.items.map((item) => ({
                fact: item.fact,
                value: Number(complex[item.fact]),
                unit: factUnits[item.fact] ?? null,
                label: text(item.label),
              })),
              background:
                image(section.content.backgroundMediaId) ??
                defaultImage("home.stats.background", locale),
            }
          : null;
      case "about": {
        const c = section.content;
        return {
          kind: "about",
          eyebrow: maybe(c.eyebrow),
          title: text(c.title),
          body: text(c.body),
          image: image(c.mediaId) ?? defaultImage("home.about.image", locale),
          background: image(c.backgroundMediaId) ?? defaultImage("home.about.background", locale),
        };
      }
      case "layouts": {
        const c = section.content;
        const groups = featuredGroups(
          groupLayouts(layouts, (id) => image(id)),
          c.featuredRooms,
        );
        return groups.length
          ? {
              kind: "layouts",
              title: text(c.title),
              body: maybe(c.body),
              groups,
              background:
                image(c.backgroundMediaId) ?? defaultImage("home.layouts.background", locale),
            }
          : null;
      }
      case "amenities":
        return {
          kind: "amenities",
          title: text(section.content.title),
          window:
            image(section.content.windowMediaId) ?? defaultImage("home.amenities.window", locale),
          items: complex.amenities.map((item) => ({
            icon: item.icon,
            title: text(item.title),
            body: maybe(item.body),
          })),
        };
      case "card_zoom": {
        const chosen = section.content.items.flatMap((item) => {
          const picture = image(item.mediaId);
          return picture
            ? [{ key: item.mediaId, image: picture, caption: maybe(item.caption) }]
            : [];
        });
        const scenes = chosen.length
          ? chosen
          : defaultScenes.map((slot) => ({
              key: slot,
              image: defaultImage(slot, locale),
              caption: null,
            }));
        return { kind: "card_zoom", title: text(section.content.title), scenes };
      }
      case "location": {
        const c = section.content;
        const body = maybe(c.body);
        const map = image(c.mapMediaId);
        if (!body && !map && !c.distances.length) return null;
        const cards = (c.cardMediaIds ?? []).flatMap((id) => image(id) ?? []);
        return {
          kind: "location",
          title: text(c.title),
          body,
          map,
          distances: c.distances.map((d) => ({ place: text(d.place), minutes: d.minutes })),
          intro: image(c.introMediaId) ?? defaultImage("home.location.intro", locale),
          moverLeft: image(c.moverLeftMediaId) ?? defaultImage("home.location.moverLeft", locale),
          moverRight:
            image(c.moverRightMediaId) ?? defaultImage("home.location.moverRight", locale),
          cards: cards.length ? cards : defaultCards.map((slot) => defaultImage(slot, locale)),
        };
      }
      case "construction":
        return latestUpdate
          ? {
              kind: "construction",
              title: text(section.content.title),
              update: {
                title: text(latestUpdate.title),
                month: latestUpdate.month,
                progress: latestUpdate.progressPercent,
                // A video's poster stands in when the update leads with a video.
                image:
                  image(updateMedia[0]?.mediaId) ??
                  video(updateMedia[0]?.mediaId)?.poster ??
                  defaultImage("home.construction.background", locale),
              },
            }
          : null;
      case "process":
        return {
          kind: "process",
          title: text(section.content.title),
          steps: section.content.steps.map((step) => ({
            title: text(step.title),
            body: text(step.body),
          })),
        };
      case "faq": {
        // Placeholders filled from the facts above; a question quoting an unknown fact is left out.
        const items = publicFaqItems(faqRows, locale, { complex, layouts });
        return items.length ? { kind: "faq", title: text(section.content.title), items } : null;
      }
      case "cta":
        return {
          kind: "cta",
          title: text(section.content.title),
          body: maybe(section.content.body),
          portrait:
            image(section.content.portraitMediaId) ?? defaultImage("home.cta.portrait", locale),
        };
    }
  });

  return resolved.filter((section): section is HomeSection => section !== null);
}
