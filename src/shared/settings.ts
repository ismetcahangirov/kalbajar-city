import { z } from "zod";

import { areaSchema } from "./inventory";
import { phoneSchema } from "./phone";
import { translatableSchema } from "./translatable";

/** Facts about the complex that pages quote: the stats row, about, the GEO facts block. */
export const complexFactKeys = [
  "totalArea",
  "residentialArea",
  "nonResidentialArea",
  "landHectares",
  "apartments",
  "buildings",
  "blocks",
  "parkingSpaces",
] as const;

export type ComplexFactKey = (typeof complexFactKeys)[number];

/** Icons the console offers for an amenity; the label is free text. */
export const amenityIcons = [
  "security",
  "fire-safety",
  "playground",
  "windows",
  "gas",
  "lobby",
  "perimeter",
  "parking",
] as const;

const count = z.int().nonnegative();

/**
 * Each settings row is a key with a JSON value whose shape is fixed here. The
 * console edits them (#27); the seed writes the values known today.
 */
export const settingsSchemas = {
  contacts: z.object({
    /** The first phone is the main line used by the call buttons. */
    phones: z.array(phoneSchema).min(1),
    whatsapp: phoneSchema.nullable(),
    email: z.email().nullable(),
    address: translatableSchema.nullable(),
    /** Office hours as free text per locale ("Mon–Sat, 10:00–19:00"); shown only when set. */
    hours: translatableSchema.nullish(),
    /** Null until the owner confirms them (#7). */
    coordinates: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .nullable(),
  }),
  socials: z.object({
    instagram: z.url().nullable(),
    facebook: z.url().nullable(),
    youtube: z.url().nullable(),
    tiktok: z.url().nullable(),
  }),
  developer: z.object({
    name: z.string().min(1),
    instagram: z.url().nullable(),
    website: z.url().nullable(),
  }),
  complex: z.object({
    totalArea: areaSchema,
    residentialArea: areaSchema,
    nonResidentialArea: areaSchema,
    landHectares: areaSchema,
    apartments: count,
    buildings: count,
    blocks: count,
    parkingSpaces: count,
    amenities: z.array(
      z.object({
        icon: z.enum(amenityIcons),
        title: translatableSchema,
        body: translatableSchema.nullish(),
      }),
    ),
  }),
  /** Whether prices are public is the owner's decision (#7); the site supports both. */
  prices: z.object({ visible: z.boolean() }),
  analytics: z.object({
    googleAnalyticsId: z.string().min(1).nullable(),
    metaPixelId: z.string().min(1).nullable(),
  }),
  /** The leads module (#26). */
  leads: z.object({
    /**
     * Who gets the e-mail about a new lead. Empty: `LEADS_INBOX`, else the
     * contacts e-mail.
     */
    recipients: z.array(z.email().max(254)).max(20),
    /** After how many months without activity a lead's personal data is cleared. */
    retentionMonths: z.int().min(6).max(120),
  }),
} satisfies Record<string, z.ZodType>;

/** The leads settings until the row is seeded: no recipients, 24 months (#26). */
export const defaultLeadSettings: SettingsValue<"leads"> = { recipients: [], retentionMonths: 24 };

export type SettingsKey = keyof typeof settingsSchemas;

export const settingsKeys = Object.keys(settingsSchemas) as SettingsKey[];

export type SettingsValue<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;

/** `/api/v1/admin/settings/:key`: an unknown key is a 404. */
export const settingsKeyParamsSchema = z.object({
  key: z.enum(settingsKeys as [SettingsKey, ...SettingsKey[]]),
});

/** A settings row as the console reads it. */
export type AdminSetting<K extends SettingsKey = SettingsKey> = {
  key: K;
  value: SettingsValue<K>;
  updatedAt: string;
};
