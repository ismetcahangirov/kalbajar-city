import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
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
import {
  homeSectionContentSchemas,
  type HomeSectionContentByKey,
  type HomeSectionKey,
} from "@/shared/home-sections";
import { settingsSchemas, type ComplexFactKey, type SettingsValue } from "@/shared/settings";

import { groupLayouts, type LayoutGroup } from "./layouts";
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
      poster: PublicImage | null;
      video: PublicVideo | null;
      /** Spec chips at the hero's foot; null until layouts exist. */
      chips: { apartments: number; roomsMin: number; roomsMax: number; areaMin: number } | null;
    }
  | { kind: "stats"; items: HomeStat[] }
  | {
      kind: "about";
      eyebrow: Localized | null;
      title: Localized;
      body: Localized;
      image: PublicImage | null;
    }
  | { kind: "layouts"; title: Localized; body: Localized | null; groups: LayoutGroup[] }
  | {
      kind: "amenities";
      title: Localized;
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
    }
  | {
      kind: "construction";
      title: Localized;
      update: { title: Localized; month: string; progress: number; image: PublicImage | null };
    }
  | { kind: "process"; title: Localized; steps: Array<{ title: Localized; body: Localized }> }
  | { kind: "faq"; title: Localized; items: Array<{ question: Localized; answer: Localized }> }
  | { kind: "cta"; title: Localized; body: Localized | null };

const factUnits: Partial<Record<ComplexFactKey, Unit>> = {
  totalArea: "m2",
  residentialArea: "m2",
  nonResidentialArea: "m2",
  landHectares: "ha",
};

/**
 * The published FAQ in the console's order (`faqOrder`), ties included. The
 * home page shows it, and its `FAQPage` structured data lists it word for
 * word, in this order.
 */
export async function loadPublishedFaq(db: Executor) {
  return db
    .select()
    .from(faq)
    .where(eq(faq.status, "published"))
    .orderBy(asc(faq.sortOrder), asc(faq.createdAt), asc(faq.id));
}

/**
 * Everything the home page shows, localised, in the console's order. A
 * section the console hides, or one with nothing to show yet (no scenes, no
 * published construction update), is left out.
 */
export async function getHomePage(locale: Locale): Promise<HomeSection[]> {
  "use cache";
  cacheTag(publicTags.content, publicTags.settings, publicTags.inventory, publicTags.media);
  cacheLife("days");

  const db = getDb();
  const [sectionRows, complexRow, layouts, faqRows, [latestUpdate]] = await Promise.all([
    db
      .select()
      .from(homeSections)
      .where(eq(homeSections.visible, true))
      .orderBy(asc(homeSections.sortOrder)),
    db.select().from(settings).where(eq(settings.key, "complex")),
    db.select().from(layoutTypes).orderBy(asc(layoutTypes.rooms), asc(layoutTypes.areaTotal)),
    loadPublishedFaq(db),
    db
      .select()
      .from(constructionUpdates)
      .where(eq(constructionUpdates.status, "published"))
      .orderBy(desc(constructionUpdates.month))
      .limit(1),
  ]);

  const complex = settingsSchemas.complex.parse(complexRow[0]?.value);
  const sections = sectionRows.map((row) => parse(row.key, row.content));

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
    if (section.key === "hero") {
      want(section.content.posterMediaId);
      want(section.content.videoMediaId);
    }
    if (section.key === "about") want(section.content.mediaId);
    if (section.key === "card_zoom") section.content.items.forEach((item) => want(item.mediaId));
    if (section.key === "location") want(section.content.mapMediaId);
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
          poster: image(c.posterMediaId) ?? video(c.videoMediaId)?.poster ?? null,
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
        return {
          kind: "stats",
          items: section.content.items.map((item) => ({
            fact: item.fact,
            value: Number(complex[item.fact]),
            unit: factUnits[item.fact] ?? null,
            label: text(item.label),
          })),
        };
      case "about": {
        const c = section.content;
        return {
          kind: "about",
          eyebrow: maybe(c.eyebrow),
          title: text(c.title),
          body: text(c.body),
          image: image(c.mediaId),
        };
      }
      case "layouts":
        return {
          kind: "layouts",
          title: text(section.content.title),
          body: maybe(section.content.body),
          groups: groupLayouts(layouts, (id) => image(id)),
        };
      case "amenities":
        return {
          kind: "amenities",
          title: text(section.content.title),
          items: complex.amenities.map((item) => ({
            icon: item.icon,
            title: text(item.title),
            body: maybe(item.body),
          })),
        };
      case "card_zoom": {
        const scenes = section.content.items.flatMap((item) => {
          const picture = image(item.mediaId);
          return picture
            ? [{ key: item.mediaId, image: picture, caption: maybe(item.caption) }]
            : [];
        });
        return scenes.length
          ? { kind: "card_zoom", title: text(section.content.title), scenes }
          : null;
      }
      case "location": {
        const c = section.content;
        const body = maybe(c.body);
        const map = image(c.mapMediaId);
        if (!body && !map && !c.distances.length) return null;
        return {
          kind: "location",
          title: text(c.title),
          body,
          map,
          distances: c.distances.map((d) => ({ place: text(d.place), minutes: d.minutes })),
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
                  image(updateMedia[0]?.mediaId) ?? video(updateMedia[0]?.mediaId)?.poster ?? null,
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
      case "faq":
        return faqRows.length
          ? {
              kind: "faq",
              title: text(section.content.title),
              items: faqRows.map((row) => ({
                question: text(row.question),
                answer: text(row.answer),
              })),
            }
          : null;
      case "cta":
        return {
          kind: "cta",
          title: text(section.content.title),
          body: maybe(section.content.body),
        };
    }
  });

  return resolved.filter((section): section is HomeSection => section !== null);
}

type ParsedSection = {
  [K in HomeSectionKey]: { key: K; content: HomeSectionContentByKey[K] };
}[HomeSectionKey];

/** Validates a row's content against its key's schema; bad console data fails loudly. */
function parse(key: HomeSectionKey, content: unknown): ParsedSection {
  return { key, content: homeSectionContentSchemas[key].parse(content) } as ParsedSection;
}
