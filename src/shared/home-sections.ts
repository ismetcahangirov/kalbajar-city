import { z } from "zod";

import { complexFactKeys } from "./settings";
import { translatableSchema } from "./translatable";

/** Home page sections in their default order (#17). */
export const homeSectionKeys = [
  "hero",
  "stats",
  "about",
  "layouts",
  "amenities",
  "card_zoom",
  "location",
  "construction",
  "process",
  "faq",
  "cta",
] as const;

export type HomeSectionKey = (typeof homeSectionKeys)[number];

const text = translatableSchema;
const mediaId = z.uuid();

/**
 * The editable content of each section. Lists that have their own table
 * (layout types, FAQ, construction updates) or a settings key (complex facts,
 * amenities) are read from there; a section only stores its own copy and the
 * choices made for it.
 */
export const homeSectionContentSchemas = {
  hero: z.object({
    title: text,
    subtitle: text.nullish(),
    /** The portrait tile's image; the video starts over it after load. */
    posterMediaId: mediaId.nullish(),
    videoMediaId: mediaId.nullish(),
    /** The render in the hero's right third, at `priority`; the LCP image on a wide screen. */
    panelMediaId: mediaId.nullish(),
  }),
  stats: z.object({
    items: z.array(z.object({ fact: z.enum(complexFactKeys), label: text })).max(6),
    backgroundMediaId: mediaId.nullish(),
  }),
  about: z.object({
    eyebrow: text.nullish(),
    title: text,
    body: text,
    mediaId: mediaId.nullish(),
    backgroundMediaId: mediaId.nullish(),
  }),
  layouts: z.object({
    title: text,
    body: text.nullish(),
    /** The room counts shown, in this order; every room count while it is empty. */
    featuredRooms: z
      .array(z.int().min(0).max(20))
      .min(1)
      .max(21)
      .refine((rooms) => new Set(rooms).size === rooms.length, "A room count may appear only once")
      .nullish(),
    backgroundMediaId: mediaId.nullish(),
  }),
  amenities: z.object({ title: text, windowMediaId: mediaId.nullish() }),
  card_zoom: z.object({
    title: text,
    items: z.array(z.object({ mediaId, caption: text.nullish() })),
  }),
  location: z.object({
    title: text,
    body: text.nullish(),
    mapMediaId: mediaId.nullish(),
    /** How to get there, for the location page; the home section does not show it. */
    directions: text.nullish(),
    distances: z.array(z.object({ place: text, minutes: z.int().positive() })),
    introMediaId: mediaId.nullish(),
    moverLeftMediaId: mediaId.nullish(),
    moverRightMediaId: mediaId.nullish(),
    /** The travel-time cards' images, used in turn; the bundled six while it is empty. */
    cardMediaIds: z.array(mediaId).max(6).nullish(),
  }),
  construction: z.object({ title: text }),
  process: z.object({
    title: text,
    steps: z.array(z.object({ title: text, body: text })).min(1),
  }),
  faq: z.object({ title: text }),
  cta: z.object({ title: text, body: text.nullish(), portraitMediaId: mediaId.nullish() }),
} satisfies Record<HomeSectionKey, z.ZodType>;

export type HomeSectionContentByKey = {
  [K in HomeSectionKey]: z.infer<(typeof homeSectionContentSchemas)[K]>;
};

export type HomeSectionContent = HomeSectionContentByKey[HomeSectionKey];

export function parseHomeSectionContent<K extends HomeSectionKey>(
  key: K,
  content: unknown,
): HomeSectionContentByKey[K] {
  return homeSectionContentSchemas[key].parse(content) as HomeSectionContentByKey[K];
}

/** A section's key with its content, narrowed together. */
export type ParsedHomeSection = {
  [K in HomeSectionKey]: { key: K; content: HomeSectionContentByKey[K] };
}[HomeSectionKey];

/** The media a section names: the images and videos its scene shows. */
export function homeSectionMedia({ key, content }: { key: HomeSectionKey; content: unknown }): {
  images: string[];
  videos: string[];
} {
  const section = { key, content } as ParsedHomeSection;
  const ids = (...values: Array<string | null | undefined>) =>
    values.filter((value): value is string => !!value);
  switch (section.key) {
    case "hero": {
      const c = section.content;
      return { images: ids(c.posterMediaId, c.panelMediaId), videos: ids(c.videoMediaId) };
    }
    case "stats":
      return { images: ids(section.content.backgroundMediaId), videos: [] };
    case "about":
      return {
        images: ids(section.content.mediaId, section.content.backgroundMediaId),
        videos: [],
      };
    case "layouts":
      return { images: ids(section.content.backgroundMediaId), videos: [] };
    case "amenities":
      return { images: ids(section.content.windowMediaId), videos: [] };
    case "card_zoom":
      return { images: section.content.items.map((item) => item.mediaId), videos: [] };
    case "location": {
      const c = section.content;
      return {
        images: ids(
          c.mapMediaId,
          c.introMediaId,
          c.moverLeftMediaId,
          c.moverRightMediaId,
          ...(c.cardMediaIds ?? []),
        ),
        videos: [],
      };
    }
    case "cta":
      return { images: ids(section.content.portraitMediaId), videos: [] };
    default:
      return { images: [], videos: [] };
  }
}

/**
 * `PUT /admin/home-sections/order`: every section, in the site's new order,
 * with whether it shows. The hero stays first and shown: it holds the page's
 * `h1` and LCP image, and the header and the scene after it are built on it.
 */
export const homeSectionOrderSchema = z.object({
  sections: z
    .array(z.object({ key: z.enum(homeSectionKeys), visible: z.boolean() }))
    .length(homeSectionKeys.length)
    .refine(
      (sections) => new Set(sections.map(({ key }) => key)).size === sections.length,
      "A section may appear only once",
    )
    .refine(
      ([first]) => first?.key === "hero" && first.visible,
      "The hero stays first and visible",
    ),
});

export type HomeSectionOrder = z.input<typeof homeSectionOrderSchema>;

/** A home section as the console reads it. */
export type AdminHomeSection<K extends HomeSectionKey = HomeSectionKey> = {
  key: K;
  sortOrder: number;
  visible: boolean;
  content: HomeSectionContentByKey[K];
  /** Null while the section has never been saved and shows its defaults. */
  updatedAt: string | null;
};
