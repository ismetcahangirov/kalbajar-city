import { z } from "zod";

import { locales } from "@/i18n/routing";

import { listOf, paginationSchema, sortSchema } from "./api";
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

// The console's leads module (#26).

export const leadEventTypes = [
  "created",
  "status_changed",
  "assigned",
  "note_added",
  "notified",
  "anonymised",
] as const;

export type LeadEventType = (typeof leadEventTypes)[number];

/** Filter values for the assignee besides a user's id. */
export const assigneeKeywords = ["me", "unassigned"] as const;

/** Better Auth's user ids: random letters and digits. */
const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Unknown user");

/** A calendar day in Baku time, `2026-11-02`; a range includes both ends. */
const daySchema = z.iso.date();

/** `GET /api/v1/admin/leads` and its CSV export. */
export const adminLeadListQuerySchema = paginationSchema
  .extend({
    status: listOf(z.enum(leadStatuses)),
    type: listOf(z.enum(leadTypes)),
    /** A lead's source: its `utm_source`, or the page it was sent from. */
    source: listOf(z.string().trim().min(1).max(500)),
    /** Apartment slugs. */
    apartment: listOf(z.string().regex(/^[a-z0-9-]{1,120}$/)),
    /** User ids, `me` or `unassigned`. */
    assignee: listOf(z.union([z.enum(assigneeKeywords), userIdSchema])),
    from: daySchema.optional(),
    to: daySchema.optional(),
    sort: sortSchema(["createdAt", "updatedAt", "name", "status"], "-createdAt"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "to must not be before from",
  });

export type AdminLeadListQuery = z.output<typeof adminLeadListQuerySchema>;

type SortKey<F extends string> = F | `-${F}`;

/** What a client passes; arrays go out comma-separated. */
export type AdminLeadListParams = {
  page?: number;
  pageSize?: number;
  status?: LeadStatus[];
  type?: LeadType[];
  source?: string[];
  apartment?: string[];
  assignee?: string[];
  from?: string;
  to?: string;
  sort?: SortKey<"createdAt" | "updatedAt" | "name" | "status">;
};

export const leadIdParamsSchema = z.object({ id: z.uuid() });

/** The longest lost reason and note the console accepts. */
export const leadTextMax = { lostReason: 500, note: 5000 } as const;

/**
 * `PATCH /api/v1/admin/leads/:id`. Any step of the pipeline, forward or
 * back, but `lost` needs a reason. `assigneeId: null` unassigns.
 */
export const leadUpdateSchema = z
  .strictObject({
    status: z.enum(leadStatuses).optional(),
    lostReason: optional(z.string().trim().min(1).max(leadTextMax.lostReason)),
    assigneeId: userIdSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.assigneeId !== undefined ||
      value.lostReason !== undefined,
    "Change at least one field",
  )
  .refine((value) => value.status !== "lost" || value.lostReason !== undefined, {
    path: ["lostReason"],
    message: "Say why the lead was lost",
  })
  .refine((value) => value.lostReason === undefined || value.status === "lost", {
    path: ["lostReason"],
    message: "A reason goes with the lost status only",
  });

export type LeadUpdate = z.input<typeof leadUpdateSchema>;

/** `POST /api/v1/admin/leads/:id/notes`. */
export const leadNoteSchema = z.strictObject({
  body: z.string().trim().min(1).max(leadTextMax.note),
});

export type LeadNoteInput = z.input<typeof leadNoteSchema>;

export type LeadUser = { id: string; name: string };

/** A lead in the console's list. */
export type AdminLead = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  name: string;
  /** E.164; empty once anonymised. */
  phone: string;
  email: string | null;
  apartment: { slug: string; label: string } | null;
  /** `utm_source`, or the page the form was sent from. */
  source: string;
  sourcePath: string;
  assignee: LeadUser | null;
  createdAt: string;
  updatedAt: string;
  anonymisedAt: string | null;
};

export type LeadTimelineEntry = {
  id: string;
  type: LeadEventType;
  at: string;
  /** `null` for the site and the system. */
  actor: LeadUser | null;
  data: Record<string, unknown> | null;
  /** The note's text, on `note_added`. */
  note?: string;
};

export type LeadNote = {
  id: string;
  body: string;
  author: LeadUser | null;
  createdAt: string;
};

export type AdminLeadDetail = AdminLead & {
  message: string | null;
  preferredAt: string | null;
  locale: (typeof locales)[number];
  utm: Partial<Record<(typeof utmKeys)[number], string>> | null;
  referrer: string | null;
  lostReason: string | null;
  /** Events and notes, newest first. */
  timeline: LeadTimelineEntry[];
  notes: LeadNote[];
};

/** New leads the user may work, for the sidebar. */
export type LeadSummary = { new: number };
