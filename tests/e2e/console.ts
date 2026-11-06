import { randomUUID } from "node:crypto";

import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";

import { connect, databaseUrl } from "@/db/client";
import { accounts, sessions, users } from "@/db/schema";
import type { UserRole } from "@/lib/auth/permissions";
import type { AdminMedia, UploadTicket } from "@/shared/media";

export const password = "an e2e passphrase that is long";

/**
 * A console account with this role and the shared test password, created or
 * reset, so a test run never depends on a previous one.
 */
export async function ensureAccount(role: UserRole, email: string, name: string): Promise<void> {
  const { db, close } = connect(databaseUrl());
  try {
    const hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      const id = existing?.id ?? randomUUID();
      if (existing) {
        await tx
          .update(users)
          .set({ role, name, banned: false, emailVerified: true })
          .where(eq(users.id, id));
        await tx.delete(sessions).where(eq(sessions.userId, id));
      } else {
        await tx.insert(users).values({ id, name, email, role, emailVerified: true });
      }
      const credential = and(eq(accounts.userId, id), eq(accounts.providerId, "credential"));
      const [account] = await tx.select({ id: accounts.id }).from(accounts).where(credential);
      if (account) {
        await tx.update(accounts).set({ password: hash }).where(eq(accounts.id, account.id));
      } else {
        await tx.insert(accounts).values({
          id: randomUUID(),
          userId: id,
          accountId: id,
          providerId: "credential",
          password: hash,
        });
      }
    });
  } finally {
    await close();
  }
}

/**
 * Signs the page's browser context in through the API, from a client IP of
 * its own so the sign-in rate limit never trips across tests.
 */
export async function signIn(page: Page, email: string, baseURL: string): Promise<void> {
  const octet = Math.floor(Math.random() * 250) + 1;
  const response = await page.request.post("/api/v1/auth/sign-in/email", {
    headers: { origin: baseURL, "x-forwarded-for": `203.0.113.${octet}` },
    data: { email, password },
  });
  expect(response.status(), `sign in as ${email}`).toBe(200);
}

/** Waits until React has hydrated the console shell, so its controls respond. */
export async function waitForShell(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[data-slot="sidebar-trigger"]');
    return trigger !== null && Object.keys(trigger).some((key) => key.startsWith("__reactFiber"));
  });
}

/** Puts a file in the library through the presigned flow. */
export async function uploadFile(
  request: APIRequestContext,
  file: { name: string; mimeType: string; bytes: Buffer; alt?: string },
): Promise<AdminMedia> {
  const ticket = (await (
    await request.post("/api/v1/admin/media/uploads", {
      data: { filename: file.name, mimeType: file.mimeType, size: file.bytes.byteLength },
    })
  ).json()) as UploadTicket;
  const put = await request.fetch(ticket.url, {
    method: ticket.method,
    headers: ticket.headers,
    data: file.bytes,
  });
  expect(put.status()).toBe(200);
  const created = await request.post("/api/v1/admin/media", {
    data: {
      key: ticket.key,
      originalName: file.name,
      source: "generated",
      ...(file.alt ? { alt: { az: file.alt } } : {}),
    },
  });
  expect(created.status()).toBe(201);
  return (await created.json()) as AdminMedia;
}

/** A small generated image with Azerbaijani alt text, in the library. */
export async function uploadImage(
  request: APIRequestContext,
  name: string,
  alt: string,
): Promise<AdminMedia> {
  const bytes = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 120, g: 140, b: 110 } },
  })
    .jpeg()
    .toBuffer();
  return uploadFile(request, { name, mimeType: "image/jpeg", bytes, alt });
}
