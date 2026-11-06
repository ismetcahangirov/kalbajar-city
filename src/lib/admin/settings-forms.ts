import { z } from "zod";

import type { Translatable } from "@/i18n/content";
import type { HomeSectionContentByKey } from "@/shared/home-sections";
import { areaInputSchema, intInput, optionalTranslatableSchema } from "@/shared/inventory";
import { phoneInputSchema } from "@/shared/phone";
import { amenityIcons, type SettingsValue } from "@/shared/settings";
import { translatableSchema } from "@/shared/translatable";

/*
 * The settings screen's forms (#27). Each schema reads what the editor typed
 * (strings, a decimal comma, blanks for "none") and outputs the value
 * `settingsSchemas[key]` (or the location section's schema) accepts, so the
 * endpoint validates the same value again. `…ToForm` turns a stored value
 * back into the form's strings.
 */

type FormText = { az: string; en: string; ru: string };

/** A translatable value as three inputs; a missing one is an empty string. */
export function textToForm(value: Partial<Translatable> | null | undefined): FormText {
  return { az: value?.az ?? "", en: value?.en ?? "", ru: value?.ru ?? "" };
}

/** A blank input is `null`; anything else, trimmed, must pass `schema`. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || null : value),
    schema.nullable(),
  );
}

const url = optional(z.url().max(500));

function blank(value: string): boolean {
  return value.trim() === "";
}

/** A coordinate as typed, with a decimal point or comma. */
function coordinate(value: string): number {
  return Number(value.trim().replace(",", "."));
}

const coordinatesForm = z
  .object({ lat: z.string(), lng: z.string() })
  .superRefine((value, ctx) => {
    if (blank(value.lat) && blank(value.lng)) return;
    const limits = { lat: 90, lng: 180 } as const;
    for (const axis of ["lat", "lng"] as const) {
      const typed = value[axis];
      if (blank(typed)) {
        ctx.addIssue({ code: "custom", path: [axis], message: "error.required" });
        continue;
      }
      const number = coordinate(typed);
      if (!Number.isFinite(number) || Math.abs(number) > limits[axis]) {
        ctx.addIssue({ code: "custom", path: [axis], message: `settings.contacts.${axis}Range` });
      }
    }
  })
  .transform((value) =>
    blank(value.lat) && blank(value.lng)
      ? null
      : { lat: coordinate(value.lat), lng: coordinate(value.lng) },
  );

export const contactsFormSchema = z.object({
  phones: z
    .array(z.object({ number: phoneInputSchema }))
    .min(1)
    .max(10)
    .transform((list) => list.map((phone) => phone.number)),
  whatsapp: optional(phoneInputSchema),
  email: optional(z.email().max(254)),
  address: optionalTranslatableSchema,
  hours: optionalTranslatableSchema,
  coordinates: coordinatesForm,
});

export type ContactsForm = z.input<typeof contactsFormSchema>;

export function contactsToForm(value: SettingsValue<"contacts">): ContactsForm {
  return {
    phones: value.phones.map((number) => ({ number })),
    whatsapp: value.whatsapp ?? "",
    email: value.email ?? "",
    address: textToForm(value.address),
    hours: textToForm(value.hours),
    coordinates: {
      lat: value.coordinates ? String(value.coordinates.lat) : "",
      lng: value.coordinates ? String(value.coordinates.lng) : "",
    },
  };
}

export const socialsFormSchema = z.object({
  instagram: url,
  facebook: url,
  youtube: url,
  tiktok: url,
});

export type SocialsForm = z.input<typeof socialsFormSchema>;

export function socialsToForm(value: SettingsValue<"socials">): SocialsForm {
  return {
    instagram: value.instagram ?? "",
    facebook: value.facebook ?? "",
    youtube: value.youtube ?? "",
    tiktok: value.tiktok ?? "",
  };
}

export const developerFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  instagram: url,
  website: url,
  logoMediaId: z.uuid().nullable(),
});

export type DeveloperForm = z.input<typeof developerFormSchema>;

export function developerToForm(value: SettingsValue<"developer">): DeveloperForm {
  return {
    name: value.name,
    instagram: value.instagram ?? "",
    website: value.website ?? "",
    logoMediaId: value.logoMediaId ?? null,
  };
}

const count = intInput(0, 1_000_000);

export const complexFormSchema = z.object({
  totalArea: areaInputSchema,
  residentialArea: areaInputSchema,
  nonResidentialArea: areaInputSchema,
  landHectares: areaInputSchema,
  apartments: count,
  buildings: count,
  blocks: count,
  parkingSpaces: count,
  amenities: z
    .array(
      z.object({
        icon: z.enum(amenityIcons),
        title: translatableSchema,
        body: optionalTranslatableSchema,
      }),
    )
    .max(30),
});

export type ComplexForm = z.input<typeof complexFormSchema>;

/** `22634.5` as an editor types it in Azerbaijani: `22634,5`. */
const typedArea = (area: string) => String(Number(area)).replace(".", ",");

export function complexToForm(value: SettingsValue<"complex">): ComplexForm {
  return {
    totalArea: typedArea(value.totalArea),
    residentialArea: typedArea(value.residentialArea),
    nonResidentialArea: typedArea(value.nonResidentialArea),
    landHectares: typedArea(value.landHectares),
    apartments: String(value.apartments),
    buildings: String(value.buildings),
    blocks: String(value.blocks),
    parkingSpaces: String(value.parkingSpaces),
    amenities: value.amenities.map((amenity) => ({
      icon: amenity.icon,
      title: textToForm(amenity.title),
      body: textToForm(amenity.body),
    })),
  };
}

export const pricesFormSchema = z.object({ visible: z.boolean() });

export type PricesForm = z.input<typeof pricesFormSchema>;

export const analyticsFormSchema = z.object({
  googleAnalyticsId: optional(z.string().max(64)),
  metaPixelId: optional(z.string().max(64)),
});

export type AnalyticsForm = z.input<typeof analyticsFormSchema>;

export function analyticsToForm(value: SettingsValue<"analytics">): AnalyticsForm {
  return {
    googleAnalyticsId: value.googleAnalyticsId ?? "",
    metaPixelId: value.metaPixelId ?? "",
  };
}

export const locationFormSchema = z.object({
  title: translatableSchema,
  body: optionalTranslatableSchema,
  mapMediaId: z.uuid().nullable(),
  directions: optionalTranslatableSchema,
  distances: z.array(z.object({ place: translatableSchema, minutes: intInput(1, 10_000) })).max(20),
  introMediaId: z.uuid().nullable().default(null),
  moverLeftMediaId: z.uuid().nullable().default(null),
  moverRightMediaId: z.uuid().nullable().default(null),
  cardMediaIds: z
    .array(z.object({ mediaId: z.uuid() }))
    .max(6)
    .default([])
    .transform((cards) => cards.map((card) => card.mediaId)),
});

export type LocationForm = z.input<typeof locationFormSchema>;

export function locationToForm(value: HomeSectionContentByKey["location"]): LocationForm {
  return {
    title: textToForm(value.title),
    body: textToForm(value.body),
    mapMediaId: value.mapMediaId ?? null,
    directions: textToForm(value.directions),
    distances: value.distances.map((distance) => ({
      place: textToForm(distance.place),
      minutes: String(distance.minutes),
    })),
    introMediaId: value.introMediaId ?? null,
    moverLeftMediaId: value.moverLeftMediaId ?? null,
    moverRightMediaId: value.moverRightMediaId ?? null,
    cardMediaIds: (value.cardMediaIds ?? []).map((mediaId) => ({ mediaId })),
  };
}
