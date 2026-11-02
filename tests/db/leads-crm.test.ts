import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, leadEvents, leadNotes, leads, settings } from "@/db/schema";
import type { AdminLead, AdminLeadDetail } from "@/shared/leads";
import type { Page } from "@/shared/api";

import { createUser, origin, type TestUser } from "./accounts";

const cache = vi.hoisted(() => ({ revalidated: [] as string[] }));
vi.mock("next/cache", () => ({
  cacheTag: () => {},
  cacheLife: () => {},
  revalidateTag: (tag: string) => void cache.revalidated.push(tag),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

const listRoute = await import("@/app/api/v1/admin/leads/route");
const itemRoute = await import("@/app/api/v1/admin/leads/[id]/route");
const notesRoute = await import("@/app/api/v1/admin/leads/[id]/notes/route");
const exportRoute = await import("@/app/api/v1/admin/leads/export.csv/route");
const summaryRoute = await import("@/app/api/v1/admin/leads/summary/route");
const settingsRoute = await import("@/app/api/v1/admin/settings/[key]/route");
const { getLeadRetentionMonths } = await import("@/lib/public/site");
const { anonymiseStaleLeads, monthsBefore } = await import("@/lib/leads/retention");

const { db, close } = connect(inject("databaseUrl"));

/** Unique per run: every lead here is sent from this page, and only these are deleted. */
const tag = randomUUID().slice(0, 8);
const page = `/t-crm-${tag}`;
/** The campaign lead's source: its `utm_source`, not the page. */
const campaign = `ig-${tag}`;

let owner: TestUser;
let admin: TestUser;
let editor: TestUser;
let sales: TestUser;
let otherSales: TestUser;

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string } = {},
): Request {
  const headers = new Headers({ "user-agent": "vitest", "x-forwarded-for": "192.0.2.26" });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const context = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

async function list(user: TestUser, query = "") {
  const search = new URLSearchParams(query);
  search.set("source", `${page},${campaign}`);
  search.set("pageSize", "100");
  const response = await listRoute.GET(request(`/admin/leads?${search}`, { cookie: user.cookie }));
  return { status: response.status, body: (await response.json()) as Page<AdminLead> };
}

const names = (body: Page<AdminLead>) => body.items.map((item) => item.name).sort();

function open(user: TestUser, id: string) {
  return itemRoute.GET(request(`/admin/leads/${id}`, { cookie: user.cookie }), context({ id }));
}

function patch(user: TestUser, id: string, body: unknown) {
  return itemRoute.PATCH(
    request(`/admin/leads/${id}`, { method: "PATCH", body, cookie: user.cookie }),
    context({ id }),
  );
}

function note(user: TestUser, id: string, body: string) {
  return notesRoute.POST(
    request(`/admin/leads/${id}/notes`, { body: { body }, cookie: user.cookie }),
    context({ id }),
  );
}

type LeadInsert = typeof leads.$inferInsert;

async function insertLead(name: string, values: Partial<LeadInsert> = {}): Promise<string> {
  const [row] = await db
    .insert(leads)
    .values({
      type: "callback",
      name: `${name} ${tag}`,
      phone: "+994501234567",
      locale: "az",
      sourcePath: page,
      ...values,
    })
    .returning({ id: leads.id });
  await db
    .insert(leadEvents)
    .values({ leadId: row!.id, type: "created", data: { type: "callback" } });
  return row!.id;
}

const id: Record<string, string> = {};

beforeAll(async () => {
  [owner, admin, editor, sales, otherSales] = await Promise.all([
    createUser("owner"),
    createUser("admin"),
    createUser("editor"),
    createUser("sales"),
    createUser("sales"),
  ]);
  id.free = await insertLead("Free");
  id.mine = await insertLead("Mine", { assigneeId: sales.id, status: "contacted" });
  id.theirs = await insertLead("Theirs", { assigneeId: otherSales.id });
  id.campaign = await insertLead("Campaign", {
    type: "viewing",
    utm: { source: campaign, campaign: tag },
  });
});

afterAll(async () => {
  await db.delete(leads).where(like(leads.sourcePath, `${page}%`));
  await db.delete(settings).where(eq(settings.key, "leads"));
  await close();
});

describe("scoping", () => {
  it("lets owner and admin list every lead, and sales only its own and unassigned ones", async () => {
    for (const user of [owner, admin]) {
      const { status, body } = await list(user);
      expect(status).toBe(200);
      expect(body.total).toBe(4);
    }
    const { body } = await list(sales);
    expect(names(body)).toEqual([`Campaign ${tag}`, `Free ${tag}`, `Mine ${tag}`]);
    expect((await list(otherSales)).body.items.map((item) => item.name)).not.toContain(
      `Mine ${tag}`,
    );
  });

  it("keeps editors out, and a sales user out of a colleague's lead in every endpoint", async () => {
    expect((await list(editor)).status).toBe(403);
    expect((await open(sales, id.theirs!)).status).toBe(403);
    expect((await patch(sales, id.theirs!, { status: "contacted" })).status).toBe(403);
    expect((await note(sales, id.theirs!, "Hello")).status).toBe(403);
    expect((await open(sales, id.mine!)).status).toBe(200);
    expect((await open(owner, randomUUID())).status).toBe(404);
  });

  it("counts the new leads the user may work for the sidebar", async () => {
    const summary = async (user: TestUser) =>
      (await (
        await summaryRoute.GET(request("/admin/leads/summary", { cookie: user.cookie }))
      ).json()) as { new: number };
    // Sales: Free and Campaign (Mine is contacted, Theirs is someone else's).
    const forSales = await summary(sales);
    const forOwner = await summary(owner);
    expect(forOwner.new - forSales.new).toBe(1);
  });
});

describe("filters", () => {
  it("filter by status, type, source, assignee and day in Baku", async () => {
    expect(names((await list(owner, "status=contacted")).body)).toEqual([`Mine ${tag}`]);
    expect(names((await list(owner, "type=viewing")).body)).toEqual([`Campaign ${tag}`]);

    // A lead's source is its utm_source when it has one, so the page alone misses it.
    const fromCampaign = await listRoute.GET(
      request(`/admin/leads?source=${campaign}`, { cookie: owner.cookie }),
    );
    const { items } = (await fromCampaign.json()) as Page<AdminLead>;
    expect(items.map((item) => [item.name, item.source, item.sourcePath])).toEqual([
      [`Campaign ${tag}`, campaign, page],
    ]);
    const fromPage = await listRoute.GET(
      request(`/admin/leads?source=${page}`, { cookie: owner.cookie }),
    );
    expect(
      ((await fromPage.json()) as Page<AdminLead>).items.map((item) => item.name),
    ).not.toContain(`Campaign ${tag}`);

    expect(names((await list(sales, "assignee=me")).body)).toEqual([`Mine ${tag}`]);
    expect(names((await list(owner, "assignee=unassigned")).body)).toEqual([
      `Campaign ${tag}`,
      `Free ${tag}`,
    ]);
    expect(names((await list(owner, `assignee=${otherSales.id}`)).body)).toEqual([`Theirs ${tag}`]);

    // 1 November 23:30 in Baku is 19:30 UTC: the 1st, not the 2nd.
    const late = await insertLead("Late", { createdAt: new Date("2025-11-01T19:30:00Z") });
    expect(names((await list(owner, "from=2025-11-01&to=2025-11-01")).body)).toEqual([
      `Late ${tag}`,
    ]);
    expect(names((await list(owner, "to=2025-11-01")).body)).toEqual([`Late ${tag}`]);
    expect((await list(owner, "from=2025-11-02&to=2025-11-02")).body.total).toBe(0);
    expect(
      (await list(owner, "from=2025-11-02")).body.items.map((item) => item.name),
    ).not.toContain(`Late ${tag}`);
    expect((await list(owner, "from=2025-11-02&to=2025-11-01")).status).toBe(400);
    await db.delete(leads).where(eq(leads.id, late));
  });
});

describe("the pipeline", () => {
  it("moves a lead any step forward or back, with a timeline entry and an audit entry each", async () => {
    const lead = await insertLead("Pipeline");
    for (const status of ["contacted", "reserved", "viewing"] as const) {
      const response = await patch(owner, lead, { status });
      expect(response.status).toBe(200);
      expect(((await response.json()) as AdminLeadDetail).status).toBe(status);
    }
    const events = await db
      .select()
      .from(leadEvents)
      .where(and(eq(leadEvents.leadId, lead), eq(leadEvents.type, "status_changed")))
      .orderBy(leadEvents.createdAt);
    expect(events.map((event) => event.data)).toEqual([
      { from: "new", to: "contacted" },
      { from: "contacted", to: "reserved" },
      { from: "reserved", to: "viewing" },
    ]);
    expect(events.every((event) => event.actorId === owner.id)).toBe(true);
    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, lead), eq(auditLog.action, "lead.update")));
    expect(audits).toHaveLength(3);
    expect(audits[0]).toMatchObject({ actorId: owner.id, entityType: "lead" });
  });

  it("needs a reason for lost, keeps it while lost and clears it after", async () => {
    const lead = await insertLead("Lost");
    const refused = await patch(sales, lead, { status: "lost" });
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      error: { fields: { lostReason: expect.any(Array) } },
    });
    expect((await patch(sales, lead, { status: "lost", lostReason: "   " })).status).toBe(422);
    expect((await patch(sales, lead, { lostReason: "Too far" })).status).toBe(422);

    const lost = await patch(sales, lead, { status: "lost", lostReason: "Bought elsewhere" });
    expect(lost.status).toBe(200);
    expect(await lost.json()).toMatchObject({ status: "lost", lostReason: "Bought elsewhere" });

    const back = (await (
      await patch(sales, lead, { status: "contacted" })
    ).json()) as AdminLeadDetail;
    expect(back).toMatchObject({ status: "contacted", lostReason: null });
    const timeline = back.timeline.filter((entry) => entry.type === "status_changed");
    expect(timeline.map((entry) => entry.data)).toEqual([
      { from: "lost", to: "contacted" },
      { from: "new", to: "lost", reason: "Bought elsewhere" },
    ]);
  });

  it("changes nothing, and records nothing, when the status is the same", async () => {
    const lead = await insertLead("Same");
    expect((await patch(owner, lead, { status: "new" })).status).toBe(200);
    const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, lead));
    expect(audits).toHaveLength(0);
  });
});

describe("assignment", () => {
  it("lets sales take an unassigned lead, and nothing else", async () => {
    const lead = await insertLead("Take");
    expect((await patch(sales, lead, { assigneeId: otherSales.id })).status).toBe(403);
    const taken = await patch(sales, lead, { assigneeId: sales.id });
    expect(taken.status).toBe(200);
    const detail = (await taken.json()) as AdminLeadDetail;
    expect(detail.assignee).toEqual({ id: sales.id, name: "Test sales" });
    expect(detail.timeline[0]).toMatchObject({
      type: "assigned",
      data: { from: null, to: sales.id, toName: "Test sales" },
    });
    // Neither handing it on nor letting it go.
    expect((await patch(sales, lead, { assigneeId: otherSales.id })).status).toBe(403);
    expect((await patch(sales, lead, { assigneeId: null })).status).toBe(403);
    // The colleague no longer sees it.
    expect((await open(otherSales, lead)).status).toBe(403);
  });

  it("lets owner and admin assign to anyone who works leads", async () => {
    const lead = await insertLead("Assign");
    expect((await patch(admin, lead, { assigneeId: otherSales.id })).status).toBe(200);
    expect((await patch(owner, lead, { assigneeId: owner.id })).status).toBe(200);
    expect((await patch(owner, lead, { assigneeId: null })).status).toBe(200);
    const editorAssigned = await patch(owner, lead, { assigneeId: editor.id });
    expect(editorAssigned.status).toBe(422);
    expect(await editorAssigned.json()).toMatchObject({
      error: { fields: { assigneeId: expect.any(Array) } },
    });
  });
});

describe("notes", () => {
  it("adds a note to the timeline and the audit log, without its text in the log", async () => {
    const lead = await insertLead("Note");
    const response = await note(sales, lead, "Zəng etdim, sabah baxışa gələcək.");
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; author: { id: string } };
    expect(created.author.id).toBe(sales.id);

    const detail = (await (await open(sales, lead)).json()) as AdminLeadDetail;
    expect(detail.timeline[0]).toMatchObject({
      type: "note_added",
      actor: { id: sales.id },
      note: "Zəng etdim, sabah baxışa gələcək.",
    });
    expect(detail.notes).toHaveLength(1);

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, lead), eq(auditLog.action, "lead.note_add")));
    expect(entry).toMatchObject({ actorId: sales.id, after: { noteId: created.id } });
    expect(JSON.stringify(entry)).not.toContain("sabah");

    expect((await note(sales, lead, "  ")).status).toBe(422);
  });
});

describe("the CSV export", () => {
  async function exportAs(user: TestUser, query = "") {
    const search = new URLSearchParams(query);
    search.set("source", `${page},${campaign}`);
    return exportRoute.GET(request(`/admin/leads/export.csv?${search}`, { cookie: user.cookie }));
  }

  it("is refused to sales", async () => {
    expect((await exportAs(sales)).status).toBe(403);
  });

  it("is UTF-8 with a BOM, quoted, guarded against formulas and filtered like the list", async () => {
    await insertLead('=HYPERLINK("http://x")', { message: 'Say "hi"; ok\nnext line' });
    const response = await exportAs(owner, "type=callback");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="/);

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(bytes.slice(3));
    const [header, ...rows] = text.trimEnd().split("\r\n");
    expect(header).toContain('"Ad";"Telefon"');
    expect(text).toContain(`"'=HYPERLINK(""http://x"") ${tag}"`);
    // Phones start with "+": prefixed too.
    expect(text).toMatch(/"'\+994\s50\s123\s45\s67"/);
    expect(text).toContain('"Say ""hi""; ok\nnext line"');
    expect(text).not.toContain(`Campaign ${tag}`);
    expect(rows.length).toBeGreaterThan(1);

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "lead.export"), eq(auditLog.actorId, owner.id)))
      .orderBy(desc(auditLog.id))
      .limit(1);
    expect(entry?.after).toMatchObject({
      filters: { type: ["callback"], source: [page, campaign] },
    });
  });
});

describe("settings", () => {
  const key = context({ key: "leads" });

  it("are saved through the settings endpoint by owner and admin only, and the privacy notice follows", async () => {
    const put = (user: TestUser, body: unknown) =>
      settingsRoute.PUT(
        request("/admin/settings/leads", { method: "PUT", body, cookie: user.cookie }),
        key,
      );
    expect((await put(sales, { recipients: [], retentionMonths: 24 })).status).toBe(403);
    expect((await put(owner, { recipients: ["x"], retentionMonths: 24 })).status).toBe(422);
    expect((await put(owner, { recipients: [], retentionMonths: 3 })).status).toBe(422);
    expect(await getLeadRetentionMonths()).toBe(24);

    cache.revalidated.length = 0;
    const value = { recipients: ["sales@test.kalbajarcity.com"], retentionMonths: 36 };
    const saved = await put(admin, value);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ key: "leads", value });
    expect(cache.revalidated).toContain("settings");
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "settings.update"), eq(auditLog.entityId, "leads")));
    expect(entry).toMatchObject({ actorId: admin.id, after: { value: { retentionMonths: 36 } } });
    expect(await getLeadRetentionMonths()).toBe(36);

    const read = await settingsRoute.GET(
      request("/admin/settings/leads", { cookie: owner.cookie }),
      key,
    );
    expect(await read.json()).toMatchObject({ value: { retentionMonths: 36 } });

    // The retention job reads the same period.
    const report = await anonymiseStaleLeads(db, { dryRun: true });
    expect(report.retentionMonths).toBe(36);
    await db.delete(settings).where(eq(settings.key, "leads"));
  });
});

describe("retention", () => {
  it("counts calendar months back", () => {
    expect(monthsBefore(new Date("2026-03-31T10:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
    expect(monthsBefore(new Date("2026-11-02T00:00:00Z"), 24).toISOString()).toBe(
      "2024-11-02T00:00:00.000Z",
    );
  });

  it("anonymises leads idle for longer than the retention period, once, as the system", async () => {
    const now = new Date("2026-11-02T12:00:00Z");
    const old = new Date("2024-10-01T12:00:00Z");
    const stale = await insertLead("Stale", {
      email: "stale@example.com",
      message: "Call me",
      referrer: "https://www.google.com/",
      utm: { source: "google" },
      createdAt: old,
      updatedAt: old,
    });
    await db.update(leadEvents).set({ createdAt: old }).where(eq(leadEvents.leadId, stale));
    await db.insert(leadNotes).values({ leadId: stale, body: "Private", createdAt: old });
    // Old, but a recent timeline entry keeps it.
    const active = await insertLead("Active", { createdAt: old, updatedAt: old });
    // `insertLead` recorded its `created` event just now.

    const dry = await anonymiseStaleLeads(db, { now, dryRun: true });
    expect(dry.ids).toContain(stale);
    expect(dry.ids).not.toContain(active);
    const [untouched] = await db.select().from(leads).where(eq(leads.id, stale));
    expect(untouched).toMatchObject({ name: `Stale ${tag}`, anonymisedAt: null });

    const run = await anonymiseStaleLeads(db, { now });
    expect(run.ids).toContain(stale);
    const [row] = await db.select().from(leads).where(eq(leads.id, stale));
    expect(row).toMatchObject({
      name: "Anonim",
      phone: "",
      email: null,
      message: null,
      referrer: null,
      utm: null,
      type: "callback",
      sourcePath: page,
    });
    expect(row?.anonymisedAt?.toISOString()).toBe(now.toISOString());
    const notes = await db.select().from(leadNotes).where(eq(leadNotes.leadId, stale));
    expect(notes.map((entry) => entry.body)).toEqual([""]);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, stale), eq(auditLog.action, "lead.anonymise")));
    expect(entry).toMatchObject({ actorId: null, before: { anonymisedAt: null } });
    expect(JSON.stringify(entry)).not.toContain("stale@example.com");
    const events = await db
      .select({ type: leadEvents.type })
      .from(leadEvents)
      .where(eq(leadEvents.leadId, stale));
    expect(events.map((event) => event.type)).toContain("anonymised");

    const [before] = await db.select().from(leads).where(eq(leads.id, stale));
    const again = await anonymiseStaleLeads(db, { now });
    expect(again.ids).not.toContain(stale);
    const [after] = await db.select().from(leads).where(eq(leads.id, stale));
    expect(after).toEqual(before);
    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, stale), eq(auditLog.action, "lead.anonymise")));
    expect(audits).toHaveLength(1);

    await db.delete(leads).where(inArray(leads.id, [stale, active]));
  });
});
