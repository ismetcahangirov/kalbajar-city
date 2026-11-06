import { z } from "zod";

import type { HomeSectionContentByKey } from "@/shared/home-sections";
import { optionalTranslatableSchema } from "@/shared/inventory";
import { complexFactKeys } from "@/shared/settings";
import { translatableSchema } from "@/shared/translatable";

import { t } from "./messages";
import { textToForm } from "./settings-forms";

/*
 * The home sections screen's forms (#17). Each schema reads what the editor
 * typed (blanks for "none") and outputs the content that section's schema in
 * `@/shared/home-sections` accepts, so the endpoint validates the same value
 * again. `…ToForm` turns stored content back into the form's values. The
 * location section's form lives with the settings (`locationFormSchema`).
 */

const media = z.uuid().nullable();

export const heroFormSchema = z.object({
  title: translatableSchema,
  subtitle: optionalTranslatableSchema,
  posterMediaId: media,
  videoMediaId: media,
  panelMediaId: media,
});
export type HeroForm = z.input<typeof heroFormSchema>;
export function heroToForm(value: HomeSectionContentByKey["hero"]): HeroForm {
  return {
    title: textToForm(value.title),
    subtitle: textToForm(value.subtitle),
    posterMediaId: value.posterMediaId ?? null,
    videoMediaId: value.videoMediaId ?? null,
    panelMediaId: value.panelMediaId ?? null,
  };
}

export const statsFormSchema = z.object({
  items: z.array(z.object({ fact: z.enum(complexFactKeys), label: translatableSchema })).max(6),
  backgroundMediaId: media,
});
export type StatsForm = z.input<typeof statsFormSchema>;
export function statsToForm(value: HomeSectionContentByKey["stats"]): StatsForm {
  return {
    items: value.items.map((item) => ({ fact: item.fact, label: textToForm(item.label) })),
    backgroundMediaId: value.backgroundMediaId ?? null,
  };
}

export const aboutFormSchema = z.object({
  eyebrow: optionalTranslatableSchema,
  title: translatableSchema,
  body: translatableSchema,
  mediaId: media,
  backgroundMediaId: media,
});
export type AboutForm = z.input<typeof aboutFormSchema>;
export function aboutToForm(value: HomeSectionContentByKey["about"]): AboutForm {
  return {
    eyebrow: textToForm(value.eyebrow),
    title: textToForm(value.title),
    body: textToForm(value.body),
    mediaId: value.mediaId ?? null,
    backgroundMediaId: value.backgroundMediaId ?? null,
  };
}

/** A room count as the form lists it: where it stands and whether it shows. */
export type FeaturedRoom = { rooms: number; shown: boolean };

/**
 * Every room count on the screen: the saved ones first, in their order, then
 * the rest. With nothing saved all of them show, as on the site.
 */
export function featuredRoomsToForm(
  saved: readonly number[] | null | undefined,
  available: readonly number[],
): FeaturedRoom[] {
  const chosen = (saved ?? []).filter((rooms) => available.includes(rooms));
  const rest = available.filter((rooms) => !chosen.includes(rooms));
  return [
    ...chosen.map((rooms) => ({ rooms, shown: true })),
    ...rest.map((rooms) => ({ rooms, shown: !chosen.length })),
  ];
}

const isAscending = (list: readonly number[]) =>
  list.every((rooms, i) => i === 0 || list[i - 1]! < rooms);

export const layoutsFormSchema = z.object({
  title: translatableSchema,
  body: optionalTranslatableSchema,
  featuredRooms: z
    .array(z.object({ rooms: z.int(), shown: z.boolean() }))
    .refine((list) => !list.length || list.some((row) => row.shown), t("home.layouts.atLeastOne"))
    // Every room count, in the default order, is stored as "no choice", so a
    // room count added later shows without anyone having to come back here.
    .transform((list) => {
      const shown = list.filter((row) => row.shown).map((row) => row.rooms);
      return shown.length === list.length && isAscending(shown) ? null : shown;
    }),
  backgroundMediaId: media,
});
export type LayoutsForm = z.input<typeof layoutsFormSchema>;
export function layoutsToForm(
  value: HomeSectionContentByKey["layouts"],
  available: readonly number[],
): LayoutsForm {
  return {
    title: textToForm(value.title),
    body: textToForm(value.body),
    featuredRooms: featuredRoomsToForm(value.featuredRooms, available),
    backgroundMediaId: value.backgroundMediaId ?? null,
  };
}

export const amenitiesFormSchema = z.object({ title: translatableSchema, windowMediaId: media });
export type AmenitiesForm = z.input<typeof amenitiesFormSchema>;
export function amenitiesToForm(value: HomeSectionContentByKey["amenities"]): AmenitiesForm {
  return { title: textToForm(value.title), windowMediaId: value.windowMediaId ?? null };
}

export const cardZoomFormSchema = z.object({
  title: translatableSchema,
  items: z.array(z.object({ mediaId: z.uuid(), caption: optionalTranslatableSchema })).max(8),
});
export type CardZoomForm = z.input<typeof cardZoomFormSchema>;
export function cardZoomToForm(value: HomeSectionContentByKey["card_zoom"]): CardZoomForm {
  return {
    title: textToForm(value.title),
    items: value.items.map((item) => ({
      mediaId: item.mediaId,
      caption: textToForm(item.caption),
    })),
  };
}

export const titleFormSchema = z.object({ title: translatableSchema });
export type TitleForm = z.input<typeof titleFormSchema>;
export function titleToForm(value: { title: HomeSectionContentByKey["faq"]["title"] }): TitleForm {
  return { title: textToForm(value.title) };
}

export const processFormSchema = z.object({
  title: translatableSchema,
  steps: z
    .array(z.object({ title: translatableSchema, body: translatableSchema }))
    .min(1)
    .max(8),
});
export type ProcessForm = z.input<typeof processFormSchema>;
export function processToForm(value: HomeSectionContentByKey["process"]): ProcessForm {
  return {
    title: textToForm(value.title),
    steps: value.steps.map((step) => ({
      title: textToForm(step.title),
      body: textToForm(step.body),
    })),
  };
}

export const ctaFormSchema = z.object({
  title: translatableSchema,
  body: optionalTranslatableSchema,
  portraitMediaId: media,
});
export type CtaForm = z.input<typeof ctaFormSchema>;
export function ctaToForm(value: HomeSectionContentByKey["cta"]): CtaForm {
  return {
    title: textToForm(value.title),
    body: textToForm(value.body),
    portraitMediaId: value.portraitMediaId ?? null,
  };
}
