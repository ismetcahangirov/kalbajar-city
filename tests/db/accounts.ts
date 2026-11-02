import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { afterAll, expect, inject } from "vitest";

import { connect } from "@/db/client";
import { accounts, users } from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";

// Better Auth and getDb() read these on first use, so they point at the test
// database before anything signs in.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.BETTER_AUTH_SECRET = "test-secret-that-is-long-enough-for-better-auth";
process.env.BETTER_AUTH_URL = "http://localhost:3010";

export const origin = process.env.BETTER_AUTH_URL;

export const password = "correct horse battery staple";

const { db, close } = connect(inject("databaseUrl"));
afterAll(close);

// Each test file loads this module afresh; a random start keeps files that
// run within the same minute from sharing addresses, and so the sign-in
// rate limit (five a minute per address), which Better Auth keeps in the
// database.
let ip = Math.floor(Math.random() * 250);

/** A request to Better Auth from its own origin, each from a new client IP. */
export function authRequest(
  path: string,
  init: { body?: unknown; cookie?: string; method?: string } = {},
) {
  const headers = new Headers({ origin, "x-forwarded-for": `198.51.100.${(ip++ % 250) + 1}` });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${origin}/api/v1/auth${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function call(path: string, init?: Parameters<typeof authRequest>[1]) {
  const { getAuth } = await import("@/lib/auth");
  return getAuth().handler(authRequest(path, init));
}

export function sessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0] ?? "")
    .find((value) => value.startsWith("better-auth.session_token="));
  if (!cookie) throw new Error(`No session cookie (status ${response.status})`);
  return cookie;
}

export async function signIn(email: string, secret = password) {
  return call("/sign-in/email", { body: { email, password: secret } });
}

export type TestUser = { id: string; email: string; role: UserRole; cookie: string };

/** A console account with a signed-in session. */
export async function createUser(role: UserRole): Promise<TestUser> {
  const id = randomUUID();
  const email = `${role}-${id.slice(0, 8)}@test.kalbajarcity.com`;
  await db.insert(users).values({ id, name: `Test ${role}`, email, role, emailVerified: true });
  await db.insert(accounts).values({
    id: randomUUID(),
    userId: id,
    accountId: id,
    providerId: "credential",
    password: await hashPassword(password),
  });
  const response = await signIn(email);
  expect(response.status, `sign in as ${role}`).toBe(200);
  return { id, email, role, cookie: sessionCookie(response) };
}
