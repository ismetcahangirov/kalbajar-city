import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { leadEvents, leads, settings } from "@/db/schema";
import type { MailMessage } from "@/lib/mail";

import { origin } from "./accounts";

// The sales e-mail runs in `after()`; here it runs at once and the test
// awaits it. The mail server is a fake that can be told to fail.
const state = vi.hoisted(() => ({
  pending: [] as Array<Promise<unknown>>,
  sent: [] as MailMessage[],
  failMail: false,
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void state.pending.push(Promise.resolve().then(task)),
}));
vi.mock("@/lib/mail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mail")>()),
  sendMail: async (message: MailMessage) => {
    if (state.failMail) throw new Error("SMTP is down");
    state.sent.push(message);
  },
}));

const leadRoute = await import("@/app/api/v1/leads/route");
const { leadRateLimit } = await import("@/lib/leads/spam");

const { db, close } = connect(inject("databaseUrl"));

const tag = randomUUID().slice(0, 6);
const sourcePath = `/t-${tag}`;
const inbox = "sales@test.kalbajarcity.com";

process.env.NEXT_PUBLIC_SITE_URL = "https://kalbajarcity.test";

let client = 0;

function post(body: unknown, ip = `198.51.100.${(client++ % 250) + 1}`) {
  return leadRoute.POST(
    new Request(`${origin}/api/v1/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

/** A call-back request as the form sends it, filled in twenty seconds. */
function lead(overrides: Record<string, unknown> = {}) {
  const sentAt = Date.now();
  return {
    type: "callback",
    name: `Aysel ${tag}`,
    phone: "050 123 45 67",
    locale: "az",
    sourcePath,
    utm: { source: "instagram", campaign: `spring-${tag}` },
    consent: true,
    website: "",
    startedAt: sentAt - 20_000,
    sentAt,
    ...overrides,
  };
}

async function settle() {
  await Promise.all(state.pending.splice(0));
}

const stored = () => db.select().from(leads).where(eq(leads.sourcePath, sourcePath));

beforeEach(() => {
  state.sent.length = 0;
  state.failMail = false;
  process.env.LEADS_INBOX = inbox;
  leadRateLimit.reset();
});

afterEach(settle);

afterAll(async () => {
  await db.delete(leads).where(eq(leads.sourcePath, sourcePath));
  await db.delete(settings).where(eq(settings.key, "contacts"));
  await close();
});

describe("a lead from a person", () => {
  it("is stored in E.164 and e-mailed to the sales inbox with a link to the console", async () => {
    const response = await post(lead({ message: "Üç otaqlı mənzil" }));
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    await settle();

    const [row] = await db.select().from(leads).where(eq(leads.id, id));
    expect(row).toMatchObject({
      phone: "+994501234567",
      sourcePath,
      utm: { source: "instagram", campaign: `spring-${tag}` },
    });

    expect(state.sent).toHaveLength(1);
    const [mail] = state.sent;
    expect(mail).toMatchObject({ to: inbox, subject: expect.stringContaining(`Aysel ${tag}`) });
    const link = `https://kalbajarcity.test/admin/muracietler/${id}`;
    expect(mail?.text).toContain(link);
    expect(mail?.text).toContain("Üç otaqlı mənzil");
    expect(mail?.text).toContain(`utm_campaign=spring-${tag}`);
    expect(mail?.html).toContain(`href="${link}"`);

    const events = await db.select().from(leadEvents).where(eq(leadEvents.leadId, id));
    expect(events.map((event) => [event.type, event.data])).toEqual([
      ["created", { type: "callback" }],
      ["notified", { ok: true }],
    ]);
  });

  it("is escaped in the e-mail's HTML", async () => {
    const response = await post(
      lead({ type: "inquiry", name: `<img src=x onerror=alert(1)> ${tag}`, message: "a & <b>" }),
    );
    expect(response.status).toBe(201);
    await settle();
    const html = state.sent[0]?.html ?? "";
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("a &amp; &lt;b&gt;");
  });

  it("is stored with a failed notification when the mail server fails", async () => {
    state.failMail = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post(lead());
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    await settle();
    error.mockRestore();

    expect(await db.select().from(leads).where(eq(leads.id, id))).toHaveLength(1);
    const [notified] = await db
      .select()
      .from(leadEvents)
      .where(and(eq(leadEvents.leadId, id), eq(leadEvents.type, "notified")));
    expect(notified?.data).toEqual({ ok: false, error: "SMTP is down" });
  });

  it("goes to the contacts e-mail when no inbox is configured, and is kept without either", async () => {
    delete process.env.LEADS_INBOX;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const nowhere = (await (await post(lead())).json()) as { id: string };
    await settle();
    const [failed] = await db
      .select()
      .from(leadEvents)
      .where(and(eq(leadEvents.leadId, nowhere.id), eq(leadEvents.type, "notified")));
    expect(failed?.data).toMatchObject({ ok: false });
    expect(state.sent).toHaveLength(0);

    await db.insert(settings).values({
      key: "contacts",
      value: {
        phones: ["+994124343232"],
        whatsapp: null,
        email: "office@test.kalbajarcity.com",
        address: null,
        coordinates: null,
      },
    });
    await post(lead());
    await settle();
    error.mockRestore();
    expect(state.sent.map((mail) => mail.to)).toEqual(["office@test.kalbajarcity.com"]);
  });
  it("goes to the recipients set in the console before LEADS_INBOX", async () => {
    await db.insert(settings).values({
      key: "leads",
      value: {
        recipients: ["a@test.kalbajarcity.com", "b@test.kalbajarcity.com"],
        retentionMonths: 24,
      },
    });
    try {
      await post(lead());
      await settle();
      expect(state.sent.map((mail) => mail.to)).toEqual([
        "a@test.kalbajarcity.com, b@test.kalbajarcity.com",
      ]);
    } finally {
      await db.delete(settings).where(eq(settings.key, "leads"));
    }
  });
});

describe("spam", () => {
  it.each([
    ["the honeypot is filled", { website: "https://cheap-pills.example" }],
    ["the form was sent within three seconds", { startedAt: Date.now() - 1000 }],
    ["the form started after it was sent", { startedAt: Date.now() + 60_000 }],
    ["the timing is missing", { startedAt: undefined, sentAt: undefined }],
  ])("is answered like a lead but stores and sends nothing when %s", async (_, overrides) => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const before = (await stored()).length;
    const response = await post(lead(overrides));
    await settle();
    debug.mockRestore();

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await db.select().from(leads).where(eq(leads.id, id))).toHaveLength(0);
    expect((await stored()).length).toBe(before);
    expect(state.sent).toHaveLength(0);
  });
});

describe("the rate limit", () => {
  it("throttles fifty requests in a minute from one IP after the fifth", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const ip = "203.0.113.50";
    // Honeypot submissions: they count like any other and store nothing.
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < 50; i++) {
      const response = await post(lead({ website: "bot" }), ip);
      statuses.push(response.status);
      if (response.status === 429) {
        retryAfter = response.headers.get("retry-after");
        expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
      }
    }
    debug.mockRestore();

    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses.slice(5).every((status) => status === 429)).toBe(true);
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeLessThanOrEqual(600);

    // Another visitor is not affected.
    expect((await post(lead())).status).toBe(201);
  });

  it("counts invalid submissions too", async () => {
    const ip = "203.0.113.51";
    for (let i = 0; i < 5; i++) expect((await post({ type: "callback" }, ip)).status).toBe(422);
    expect((await post(lead(), ip)).status).toBe(429);
  });
});
