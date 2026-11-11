import { z } from "zod";

import { privacy } from "@/config/privacy";

import { areaSchema } from "./inventory";
import { phoneSchema } from "./phone";
import { placeholdersSchema } from "./placeholders";
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
 * What the search engines' verification tokens look like: Google's
 * `google-site-verification` is URL-safe base64 (43 characters today), Bing's
 * `msvalidate.01` is 32 hexadecimal digits. Anything else is not put into a
 * page's `<head>`.
 */
export const siteVerificationFormats = {
  google: /^[A-Za-z0-9_-]{10,100}$/,
  bing: /^[A-Fa-f0-9]{32}$/,
} as const;

/**
 * The token from what an editor pasted: the token itself, or the whole meta
 * tag the search engine shows (`<meta name="msvalidate.01" content="…" />`).
 * Blank is null.
 */
export function verificationToken(typed: string): string | null {
  const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(typed)?.[1] ?? typed;
  return content.trim() || null;
}

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
    /** The developer's logo from the media library; the `Organization` logo once set. */
    logoMediaId: z.uuid().nullish(),
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
    /**
     * Site ownership for Google Search Console and Bing Webmaster Tools
     * (#28, #29): the `content` of their verification meta tags. Optional, so
     * rows saved before these fields existed still parse.
     */
    googleSiteVerification: z.string().regex(siteVerificationFormats.google).nullish(),
    bingSiteVerification: z.string().regex(siteVerificationFormats.bing).nullish(),
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
  /**
   * Which values are still stand-ins waiting for the owner (#7, #27). Written
   * by the seed and cleared by the console's saves, never through the
   * generic settings endpoint.
   */
  placeholders: placeholdersSchema,
} satisfies Record<string, z.ZodType>;

/** The leads settings until the row is seeded: no recipients, the privacy notice's period (#26). */
export const defaultLeadSettings: SettingsValue<"leads"> = {
  recipients: [],
  retentionMonths: privacy.retentionMonths,
};

export type SettingsKey = keyof typeof settingsSchemas;

export const settingsKeys = Object.keys(settingsSchemas) as SettingsKey[];

export type SettingsValue<K extends SettingsKey> = z.infer<(typeof settingsSchemas)[K]>;

/** The keys the settings endpoint reads and writes: every one but `placeholders`. */
export type EditableSettingsKey = Exclude<SettingsKey, "placeholders">;

export const editableSettingsKeys = settingsKeys.filter(
  (key): key is EditableSettingsKey => key !== "placeholders",
);

/** `/api/v1/admin/settings/:key`: an unknown key, or `placeholders`, is a 404. */
export const settingsKeyParamsSchema = z.object({
  key: z.enum(editableSettingsKeys as [EditableSettingsKey, ...EditableSettingsKey[]]),
});

/** A settings row as the console reads it. */
export type AdminSetting<K extends SettingsKey = SettingsKey> = {
  key: K;
  value: SettingsValue<K>;
  updatedAt: string;
};
