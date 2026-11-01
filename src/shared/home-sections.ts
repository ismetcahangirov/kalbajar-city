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
    /** The LCP element; the video starts after load. */
    posterMediaId: mediaId.nullish(),
    videoMediaId: mediaId.nullish(),
  }),
  stats: z.object({
    items: z.array(z.object({ fact: z.enum(complexFactKeys), label: text })).max(6),
  }),
  about: z.object({
    eyebrow: text.nullish(),
    title: text,
    body: text,
    mediaId: mediaId.nullish(),
  }),
  layouts: z.object({ title: text, body: text.nullish() }),
  amenities: z.object({ title: text }),
  card_zoom: z.object({
    title: text,
    items: z.array(z.object({ mediaId, caption: text.nullish() })),
  }),
  location: z.object({
    title: text,
    body: text.nullish(),
    mapMediaId: mediaId.nullish(),
    distances: z.array(z.object({ place: text, minutes: z.int().positive() })),
  }),
  construction: z.object({ title: text }),
  process: z.object({
    title: text,
    steps: z.array(z.object({ title: text, body: text })).min(1),
  }),
  faq: z.object({ title: text }),
  cta: z.object({ title: text, body: text.nullish() }),
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
