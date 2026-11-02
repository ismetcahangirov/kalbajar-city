import { z } from "zod";

import { locales } from "@/i18n/routing";

import { phoneInputSchema } from "./phone";

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

export const utmKeys = ["source", "medium", "campaign", "term", "content"] as const;

/**
 * A viewing slot is picked in Baku time, wherever the visitor is: the complex
 * is in Azerbaijan, which keeps UTC+4 all year.
 */
export const viewingUtcOffset = "+04:00";

/** How far ahead a viewing may be booked. */
const viewingHorizonMs = 366 * 24 * 60 * 60 * 1000;

/** A form filled faster than this was filled by a script (the time trap). */
export const minimumFillMs = 3000;

const epochMs = z.int().nonnegative();

const leadFields = {
  name: z.string().trim().min(2).max(120),
  phone: phoneInputSchema,
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
  /** The visitor agreed to the privacy notice. */
  consent: z.literal(true),
  /**
   * The honeypot: a field people never see, so it stays empty. A bot that
   * fills it gets a normal answer and nothing is stored.
   */
  website: z.string().max(500).optional(),
  /**
   * The time trap: when the form appeared and when it was sent, both by the
   * visitor's clock. Comparing the two, not one with the server's clock, keeps
   * a visitor whose clock is off from losing their lead.
   */
  startedAt: epochMs.optional(),
  sentAt: epochMs.optional(),
};

/**
 * `POST /api/v1/leads`, from the inquiry, viewing and call-back forms. One
 * branch per type, so a viewing without its date is reported together with
 * every other invalid field. The forms validate with this same schema before
 * they send.
 */
export const leadSubmissionSchema = z.discriminatedUnion("type", [
  z.object({ ...leadFields, type: z.literal("inquiry") }),
  z.object({ ...leadFields, type: z.literal("callback") }),
  z.object({
    ...leadFields,
    type: z.literal("viewing"),
    /** The slot asked for, in the future and within a year. */
    preferredAt: z.iso.datetime({ offset: true }).refine((value) => {
      const at = Date.parse(value);
      return at > Date.now() && at < Date.now() + viewingHorizonMs;
    }, "Choose a time in the coming year"),
  }),
]);

export type LeadSubmission = z.input<typeof leadSubmissionSchema>;

export type LeadCreated = { id: string };
