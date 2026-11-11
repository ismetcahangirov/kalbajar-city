import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, inject, it, vi } from "vitest";

import { connect } from "@/db/client";
import { auditLog, sessions } from "@/db/schema";
import { audit } from "@/lib/audit";

import { createUser, origin, sessionCookie, type TestUser } from "./accounts";

// Production behind Cloudflare: only `cf-connecting-ip` names the client.
// Set before Better Auth is created, which reads it once.
process.env.TRUSTED_CLIENT_IP_HEADER = "cf-connecting-ip";
const globalForAuth = globalThis as unknown as { auth?: unknown };
delete globalForAuth.auth;

const { getAuth } = await import("@/lib/auth");
const leadRoute = await import("@/app/api/v1/leads/route");
const { leadRateLimit } = await import("@/lib/leads/spam");

const { db, close } = connect(inject("databaseUrl"));

let user: TestUser;

beforeAll(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  user = await createUser("admin");
});

afterAll(async () => {
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
  delete globalForAuth.auth;
  vi.restoreAllMocks();
  await close();
});

/** What reaches the app when a client sends its own `X-Forwarded-For`. */
function behindCloudflare(real: string | null, spoofed = "203.0.113.9") {
  const headers = new Headers({ origin, "x-forwarded-for": `${spoofed}, ${real ?? "198.18.0.1"}` });
  if (real) headers.set("cf-connecting-ip", real);
  return headers;
}

function signIn(headers: Headers, password = "correct horse battery staple") {
  headers.set("content-type", "application/json");
  return getAuth().handler(
    new Request(`${origin}/api/v1/auth/sign-in/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: user.email, password }),
    }),
  );
}

describe("client IP with TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip", () => {
  it("records Cloudflare's address on a session, not the spoofed one", async () => {
    const real = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
    const response = await signIn(behindCloudflare(real));
    expect(response.status).toBe(200);
    const token = decodeURIComponent(sessionCookie(response).split("=")[1] ?? "").split(".")[0];
    const [row] = await db
      .select({ ip: sessions.ipAddress })
      .from(sessions)
      .where(eq(sessions.token, token ?? ""));
    expect(row?.ip).toBe(real);
  });

  it("limits sign-ins without the header together, whatever X-Forwarded-For says", async () => {
    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const response = await signIn(behindCloudflare(null, `203.0.113.${i}`), "wrong password");
      statuses.push(response.status);
    }
    // Six spoofed addresses are still one unknown client: the limit (five) holds.
    expect(statuses).toContain(429);
  });

  it("counts lead submissions by Cloudflare's address, and unknown clients together", async () => {
    leadRateLimit.reset();
    const post = (headers: Headers) =>
      leadRoute.POST(
        new Request(`${origin}/api/v1/leads`, { method: "POST", headers, body: "{}" }),
      );

    // One client rotating a spoofed X-Forwarded-For is still one client.
    for (let i = 1; i <= 5; i++) {
      expect((await post(behindCloudflare("198.51.100.20", `203.0.113.${i}`))).status).not.toBe(
        429,
      );
    }
    expect((await post(behindCloudflare("198.51.100.20", "203.0.113.99"))).status).toBe(429);
    expect((await post(behindCloudflare("198.51.100.21"))).status).not.toBe(429);

    // Without the header the address is unknown: one shared limit.
    for (let i = 1; i <= 5; i++) {
      expect((await post(behindCloudflare(null, `203.0.113.${i}`))).status).not.toBe(429);
    }
    expect((await post(behindCloudflare(null, "203.0.113.100"))).status).toBe(429);
    leadRateLimit.reset();
  });

  it("writes Cloudflare's address to the audit log", async () => {
    const entityId = randomUUID();
    await audit(db, {
      actorId: null,
      action: "test.client-ip",
      entityType: "test",
      entityId,
      after: { id: entityId },
      headers: behindCloudflare("198.51.100.30"),
    });
    await audit(db, {
      actorId: null,
      action: "test.client-ip",
      entityType: "test",
      entityId,
      after: { id: entityId },
      headers: behindCloudflare(null),
    });
    const rows = await db
      .select({ ip: auditLog.ip })
      .from(auditLog)
      .where(eq(auditLog.entityId, entityId));
    expect(rows.map((row) => row.ip).sort()).toEqual(["198.51.100.30", null].sort());
    await db.delete(auditLog).where(eq(auditLog.entityId, entityId));
  });
});
