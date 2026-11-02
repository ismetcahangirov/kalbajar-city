import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Executor } from "@/db/client";
import { apartments, blocks, floors, leadEvents, leadNotes, leads, users } from "@/db/schema";
import { forbiddenError, invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { can, userRoles } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { offsetOf, toPage, type Page } from "@/shared/api";
import type {
  AdminLead,
  AdminLeadDetail,
  AdminLeadListQuery,
  LeadNote,
  LeadSummary,
  LeadTimelineEntry,
  LeadUser,
  leadUpdateSchema,
} from "@/shared/leads";
import type { z } from "zod";

import { bakuOffset } from "./week";

type Actor = Pick<SessionUser, "id" | "role">;

/** Whether the user sees every lead and assigns to anyone (`leads:assign`). */
export function seesAllLeads(role: SessionUser["role"]): boolean {
  return can(role, { leads: ["assign"] });
}

/**
 * The leads a user may list, open and change: all of them with
 * `leads:assign`, otherwise only theirs and the unassigned ones. Every
 * endpoint applies it on the server, not only the console's screens.
 */
export function leadScope(user: Actor): SQL | undefined {
  if (seesAllLeads(user.role)) return undefined;
  return or(isNull(leads.assigneeId), eq(leads.assigneeId, user.id));
}

/** A lead's source: its `utm_source` when the visit had one, else the page. */
export const leadSource = sql<string>`coalesce(nullif(${leads.utm}->>'source', ''), ${leads.sourcePath})`;

const assignee = alias(users, "assignee");

const listColumns = {
  id: leads.id,
  type: leads.type,
  status: leads.status,
  name: leads.name,
  phone: leads.phone,
  email: leads.email,
  sourcePath: leads.sourcePath,
  source: leadSource,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  anonymisedAt: leads.anonymisedAt,
  apartmentSlug: apartments.slug,
  apartmentNumber: apartments.number,
  block: blocks.code,
  assigneeId: assignee.id,
  assigneeName: assignee.name,
};

function listRows(db: Executor, fields = listColumns) {
  return db
    .select(fields)
    .from(leads)
    .leftJoin(apartments, eq(apartments.id, leads.apartmentId))
    .leftJoin(floors, eq(floors.id, apartments.floorId))
    .leftJoin(blocks, eq(blocks.id, floors.blockId))
    .leftJoin(assignee, eq(assignee.id, leads.assigneeId));
}

/** `A-12`: the block and the number, as sales says it. */
export function apartmentLabel(block: string | null, number: string): string {
  return block ? `${block}-${number}` : number;
}

type ListRow = Awaited<ReturnType<typeof listRows>>[number];

function toAdminLead(row: ListRow): AdminLead {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    name: row.name,
    phone: row.phone,
    email: row.email,
    apartment:
      row.apartmentSlug && row.apartmentNumber
        ? { slug: row.apartmentSlug, label: apartmentLabel(row.block, row.apartmentNumber) }
        : null,
    source: row.source,
    sourcePath: row.sourcePath,
    assignee: row.assigneeId ? { id: row.assigneeId, name: row.assigneeName ?? "" } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    anonymisedAt: row.anonymisedAt?.toISOString() ?? null,
  };
}

/** Midnight in Baku that starts `day` (`2026-11-02`), as an instant. */
export function bakuDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - bakuOffset);
}

const dayMs = 24 * 60 * 60 * 1000;

type Filters = Omit<AdminLeadListQuery, "page" | "pageSize" | "sort">;

/** The list's filters as one condition, inside the user's scope. */
export function leadFilters(query: Filters, user: Actor): SQL | undefined {
  const named = query.assignee.filter((value) => value !== "me" && value !== "unassigned");
  const assignees = [
    query.assignee.includes("me") ? eq(leads.assigneeId, user.id) : undefined,
    query.assignee.includes("unassigned") ? isNull(leads.assigneeId) : undefined,
    named.length ? inArray(leads.assigneeId, named) : undefined,
  ].filter((condition) => condition !== undefined);

  return and(
    leadScope(user),
    query.status.length ? inArray(leads.status, query.status) : undefined,
    query.type.length ? inArray(leads.type, query.type) : undefined,
    query.source.length ? inArray(leadSource, query.source) : undefined,
    query.apartment.length ? inArray(apartments.slug, query.apartment) : undefined,
    assignees.length ? or(...assignees) : undefined,
    query.from ? gte(leads.createdAt, bakuDayStart(query.from)) : undefined,
    // `to` includes its whole day.
    query.to ? lt(leads.createdAt, new Date(bakuDayStart(query.to).getTime() + dayMs)) : undefined,
  );
}

const sortColumns = {
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  name: leads.name,
  // Postgres orders an enum by its declaration: the pipeline's order.
  status: leads.status,
} as const;

function orderOf(sort: AdminLeadListQuery["sort"]) {
  const direction = sort.direction === "desc" ? desc : asc;
  return [direction(sortColumns[sort.field]), desc(leads.createdAt), desc(leads.id)];
}

/** The console's lead list, within the user's scope. */
export async function listAdminLeads(
  db: Executor,
  query: AdminLeadListQuery,
  user: Actor,
): Promise<Page<AdminLead>> {
  const where = leadFilters(query, user);
  const [rows, [totals]] = await Promise.all([
    listRows(db)
      .where(where)
      .orderBy(...orderOf(query.sort))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(leads)
      .leftJoin(apartments, eq(apartments.id, leads.apartmentId))
      .where(where),
  ]);
  return toPage(rows.map(toAdminLead), totals?.total ?? 0, query);
}

/** New leads the user may work, for the count on the sidebar. */
export async function leadSummary(db: Executor, user: Actor): Promise<LeadSummary> {
  const [row] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(leadScope(user), eq(leads.status, "new")));
  return { new: row?.total ?? 0 };
}

/**
 * The lead, or a 404; a lead outside the user's scope is a 403, so a sales
 * user following the e-mail link to a colleague's lead learns why.
 */
async function leadRow(db: Executor, id: string, user: Actor, lock = false) {
  const query = db.select().from(leads).where(eq(leads.id, id));
  const [row] = await (lock ? query.for("update") : query);
  if (!row) throw notFound("No such lead.");
  if (!seesAllLeads(user.role) && row.assigneeId !== null && row.assigneeId !== user.id) {
    throw forbiddenError();
  }
  return row;
}

/** The lead with its apartment, timeline and notes. */
export async function getAdminLead(
  db: Executor,
  id: string,
  user: Actor,
): Promise<AdminLeadDetail> {
  const lead = await leadRow(db, id, user);
  const [[row], events, notes] = await Promise.all([
    listRows(db).where(eq(leads.id, id)),
    db
      .select({ event: leadEvents, actorName: users.name })
      .from(leadEvents)
      .leftJoin(users, eq(users.id, leadEvents.actorId))
      .where(eq(leadEvents.leadId, id))
      .orderBy(desc(leadEvents.createdAt), desc(leadEvents.id)),
    db
      .select({ note: leadNotes, authorName: users.name })
      .from(leadNotes)
      .leftJoin(users, eq(users.id, leadNotes.authorId))
      .where(eq(leadNotes.leadId, id))
      .orderBy(desc(leadNotes.createdAt), desc(leadNotes.id)),
  ]);
  if (!row) throw notFound("No such lead.");

  const notesById = new Map(notes.map(({ note }) => [note.id, note.body]));
  // Assignment events name users by id; the timeline shows their names.
  const assigned = events.flatMap(({ event }) =>
    event.type === "assigned" ? [event.data?.from, event.data?.to] : [],
  );
  const ids = [...new Set(assigned.filter((value): value is string => typeof value === "string"))];
  const names = ids.length
    ? new Map(
        (
          await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, ids))
        ).map((user) => [user.id, user.name]),
      )
    : new Map<string, string>();

  const timeline: LeadTimelineEntry[] = events.map(({ event, actorName }) => {
    const entry: LeadTimelineEntry = {
      id: event.id,
      type: event.type,
      at: event.createdAt.toISOString(),
      actor: event.actorId ? { id: event.actorId, name: actorName ?? "" } : null,
      data: event.data ?? null,
    };
    if (event.type === "assigned") {
      const name = (value: unknown) =>
        typeof value === "string" ? (names.get(value) ?? null) : null;
      entry.data = {
        ...event.data,
        fromName: name(event.data?.from),
        toName: name(event.data?.to),
      };
    }
    const noteId = event.data?.noteId;
    if (event.type === "note_added" && typeof noteId === "string") {
      entry.note = notesById.get(noteId) ?? "";
    }
    return entry;
  });

  return {
    ...toAdminLead(row),
    message: lead.message,
    preferredAt: lead.preferredAt?.toISOString() ?? null,
    locale: lead.locale as AdminLeadDetail["locale"],
    utm: lead.utm ?? null,
    referrer: lead.referrer,
    lostReason: lead.lostReason,
    timeline,
    notes: notes.map(({ note, authorName }): LeadNote => ({
      id: note.id,
      body: note.body,
      author: note.authorId ? { id: note.authorId, name: authorName ?? "" } : null,
      createdAt: note.createdAt.toISOString(),
    })),
  };
}

/** Roles that work leads, so they can be assigned one. */
const leadRoles = userRoles.filter((role) => can(role, { leads: ["read"] }));

/** Active accounts a lead can be assigned to, by name. */
export async function assignableUsers(db: Executor): Promise<LeadUser[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(inArray(users.role, leadRoles), eq(users.banned, false)))
    .orderBy(asc(users.name), asc(users.id));
}

type Update = z.output<typeof leadUpdateSchema>;

/**
 * Moves a lead along the pipeline and assigns it, with a timeline entry per
 * change and the audit entry in the same transaction. Any step forward or
 * back is allowed; `lost` carries its reason, which leaving `lost` clears.
 * Without `leads:assign` a user may only take an unassigned lead.
 */
export async function updateLead(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: { id: string; input: Update; user: Actor; headers?: Headers | null },
): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await leadRow(tx, id, user, true);
    const set: Partial<typeof leads.$inferInsert> = {};
    const events: Array<typeof leadEvents.$inferInsert> = [];

    const status = input.status ?? before.status;
    const reason = input.lostReason?.trim() || null;
    if (status !== before.status || (status === "lost" && reason && reason !== before.lostReason)) {
      set.status = status;
      set.lostReason = status === "lost" ? reason : null;
      events.push({
        leadId: id,
        type: "status_changed",
        actorId: user.id,
        data: { from: before.status, to: status, ...(status === "lost" ? { reason } : {}) },
      });
    }

    if (input.assigneeId !== undefined && input.assigneeId !== before.assigneeId) {
      const to = input.assigneeId;
      if (!seesAllLeads(user.role) && !(before.assigneeId === null && to === user.id)) {
        throw forbiddenError();
      }
      if (to !== null) {
        const [target] = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, to), inArray(users.role, leadRoles), eq(users.banned, false)));
        if (!target) throw invalidField("assigneeId", "This user cannot work leads");
      }
      set.assigneeId = to;
      events.push({
        leadId: id,
        type: "assigned",
        actorId: user.id,
        data: { from: before.assigneeId, to },
      });
    }

    if (!events.length) return;
    const [after] = await tx.update(leads).set(set).where(eq(leads.id, id)).returning();
    await tx.insert(leadEvents).values(events);
    await audit(tx, {
      actorId: user.id,
      action: "lead.update",
      entityType: "lead",
      entityId: id,
      before,
      after,
      headers,
    });
  });
}

/**
 * Adds a note, with its timeline entry and audit entry. The audit keeps the
 * note's id, not its text: notes are personal data the retention job clears,
 * and the audit log is never rewritten.
 */
export async function addLeadNote(
  db: Executor,
  { id, body, user, headers }: { id: string; body: string; user: Actor; headers?: Headers | null },
): Promise<LeadNote> {
  return db.transaction(async (tx) => {
    await leadRow(tx, id, user, true);
    const [note] = await tx
      .insert(leadNotes)
      .values({ leadId: id, authorId: user.id, body })
      .returning();
    if (!note) throw new Error("The note was not stored");
    await tx
      .insert(leadEvents)
      .values({ leadId: id, type: "note_added", actorId: user.id, data: { noteId: note.id } });
    // A note is activity: it keeps the lead from the retention job.
    await tx.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "lead.note_add",
      entityType: "lead",
      entityId: id,
      after: { noteId: note.id },
      headers,
    });
    const [author] = await tx.select({ name: users.name }).from(users).where(eq(users.id, user.id));
    return {
      id: note.id,
      body: note.body,
      author: { id: user.id, name: author?.name ?? "" },
      createdAt: note.createdAt.toISOString(),
    };
  });
}

export type LeadFilterOptions = {
  sources: string[];
  apartments: Array<{ slug: string; label: string }>;
  assignees: LeadUser[];
};

/** What the list's filters offer: values that occur in the user's leads. */
export async function leadFilterOptions(db: Executor, user: Actor): Promise<LeadFilterOptions> {
  const scope = leadScope(user);
  const [sources, apartmentRows, assignees] = await Promise.all([
    db
      .select({ source: leadSource, total: count() })
      .from(leads)
      .where(scope)
      .groupBy(leadSource)
      .orderBy(desc(count()), asc(leadSource))
      .limit(50),
    db
      .selectDistinct({ slug: apartments.slug, number: apartments.number, block: blocks.code })
      .from(leads)
      .innerJoin(apartments, eq(apartments.id, leads.apartmentId))
      .innerJoin(floors, eq(floors.id, apartments.floorId))
      .innerJoin(blocks, eq(blocks.id, floors.blockId))
      .where(scope)
      .orderBy(asc(blocks.code), asc(apartments.number))
      .limit(200),
    seesAllLeads(user.role) ? assignableUsers(db) : Promise.resolve([]),
  ]);
  return {
    // A comma separates values in the URL; such a source cannot be a filter.
    sources: sources.map((row) => row.source).filter((source) => !source.includes(",")),
    apartments: apartmentRows.map((row) => ({
      slug: row.slug,
      label: apartmentLabel(row.block, row.number),
    })),
    assignees,
  };
}

/** Every lead the filters match, newest first, with what the CSV export needs. */
export async function exportLeadRows(db: Executor, query: Filters, user: Actor) {
  return db
    .select({
      ...listColumns,
      message: leads.message,
      preferredAt: leads.preferredAt,
      locale: leads.locale,
      utm: leads.utm,
      referrer: leads.referrer,
      lostReason: leads.lostReason,
    })
    .from(leads)
    .leftJoin(apartments, eq(apartments.id, leads.apartmentId))
    .leftJoin(floors, eq(floors.id, apartments.floorId))
    .leftJoin(blocks, eq(blocks.id, floors.blockId))
    .leftJoin(assignee, eq(assignee.id, leads.assigneeId))
    .where(leadFilters(query, user))
    .orderBy(desc(leads.createdAt), desc(leads.id));
}

export type LeadExportRow = Awaited<ReturnType<typeof exportLeadRows>>[number];
