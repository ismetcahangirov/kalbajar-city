import { z } from "zod";

import { locales } from "@/i18n/routing";

import { phoneSchema } from "./phone";

export const leadTypes = ["inquiry", "viewing", "callback"] as const;

export type LeadType = (typeof leadTypes)[number];

/** The sales pipeline (spec §5): new → contacted → viewing → reserved → closed / lost. */
export const leadStatuses = ["new", "contacted", "viewing", "reserved", "closed", "lost"] as const;

export type LeadStatus = (typeof leadStatuses)[number];

/** An empty form field arrives as `""`; it means "not given". */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

const utmValue = optional(z.string().trim().max(200));

const leadFields = {
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: optional(z.email().max(254)),
  message: optional(z.string().trim().max(2000)),
  /** The slug of the apartment the form was sent from. */
  apartment: optional(z.string().regex(/^[a-z0-9-]{1,120}$/)),
  locale: z.enum(locales),
  /** The page the form was sent from, without the origin. */
  sourcePath: z.string().startsWith("/").max(500),
  utm: z
    .object({
      source: utmValue,
      medium: utmValue,
      campaign: utmValue,
      term: utmValue,
      content: utmValue,
    })
    .optional(),
  referrer: optional(z.url().max(1000)),
};

/**
 * `POST /api/v1/leads`, from the inquiry, viewing and call-back forms. One
 * branch per type, so a viewing without its date is reported together with
 * every other invalid field. The spam defences, rate limit and sales e-mail
 * arrive with the forms (#22).
 */
export const leadSubmissionSchema = z.discriminatedUnion("type", [
  z.object({ ...leadFields, type: z.literal("inquiry") }),
  z.object({ ...leadFields, type: z.literal("callback") }),
  z.object({
    ...leadFields,
    type: z.literal("viewing"),
    /** The slot asked for. */
    preferredAt: z.iso.datetime({ offset: true }),
  }),
]);

export type LeadSubmission = z.input<typeof leadSubmissionSchema>;

export type LeadCreated = { id: string };
