import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { id, timestamps, userId } from "./columns";
import { apartments } from "./inventory";

export const leadType = pgEnum("lead_type", ["inquiry", "viewing", "callback"]);

/** The sales pipeline (spec §5): new → contacted → viewing → reserved → closed / lost. */
export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "viewing",
  "reserved",
  "closed",
  "lost",
]);

export const leadEventType = pgEnum("lead_event_type", [
  "created",
  "status_changed",
  "assigned",
  "note_added",
  "notified",
]);

export type LeadUtm = Partial<
  Record<"source" | "medium" | "campaign" | "term" | "content", string>
>;

export const leads = pgTable(
  "leads",
  {
    id: id(),
    type: leadType("type").notNull(),
    status: leadStatus("status").notNull().default("new"),
    name: text("name").notNull(),
    /** E.164. */
    phone: text("phone").notNull(),
    email: text("email"),
    message: text("message"),
    /** The slot a viewing was requested for. */
    preferredAt: timestamp("preferred_at", { withTimezone: true }),
    /** The apartment the lead came from, kept when the apartment is removed. */
    apartmentId: uuid("apartment_id").references(() => apartments.id, { onDelete: "set null" }),
    locale: text("locale").notNull(),
    /** The page the form was sent from, without the origin. */
    sourcePath: text("source_path").notNull(),
    utm: jsonb("utm").$type<LeadUtm>(),
    referrer: text("referrer"),
    assigneeId: userId("assignee_id"),
    ...timestamps,
  },
  (t) => [
    index("leads_status_created_idx").on(t.status, t.createdAt),
    index("leads_apartment_idx").on(t.apartmentId),
    check("leads_locale", sql`${t.locale} in ('az', 'en', 'ru')`),
  ],
);

export const leadNotes = pgTable(
  "lead_notes",
  {
    id: id(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    authorId: userId("author_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_notes_lead_idx").on(t.leadId, t.createdAt)],
);

/** The lead's timeline: every status change, assignment, note and notification. */
export const leadEvents = pgTable(
  "lead_events",
  {
    id: id(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: leadEventType("type").notNull(),
    actorId: userId("actor_id"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_events_lead_idx").on(t.leadId, t.createdAt)],
);
