import { expect, test, type APIRequestContext } from "@playwright/test";
import { eq } from "drizzle-orm";

import { connect, databaseUrl } from "@/db/client";
import { leads } from "@/db/schema";
import { setOwner } from "@/lib/auth/owner";

const email = "e2e-api@test.kalbajarcity.com";
const password = "an e2e passphrase that is long";

// One apartment is changed and restored, so the file runs once, not per
// device, and in one worker, so beforeAll creates the owner once.
test.skip(({ isMobile }) => isMobile, "the API does not depend on the viewport");
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { db, close } = connect(databaseUrl());
  try {
    await setOwner(db, { email, name: "E2E API Owner", password });
  } finally {
    await close();
  }
});

async function signIn(request: APIRequestContext, baseURL: string) {
  const octet = Math.floor(Math.random() * 250) + 1;
  const response = await request.post("/api/v1/auth/sign-in/email", {
    headers: { origin: baseURL, "x-forwarded-for": `198.51.100.${octet}` },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

type Item = { id: string; slug: string; number: string; status: string; block: string };

test("an admin write shows on the public API's next request, served from its cache", async ({
  request,
  baseURL,
}) => {
  const list = await request.get("/api/v1/apartments?status=available&pageSize=1");
  expect(list.status()).toBe(200);
  const [first] = (
    (await list.json()) as {
      items: Array<{ slug: string; number: string; block: { code: string } }>;
    }
  ).items;
  expect(first, "the seed has available apartments").toBeTruthy();
  const { slug } = first!;

  // Warm the cached loader, so a stale copy would be what the next read gets.
  const detail = () => request.get(`/api/v1/apartments/${slug}`);
  expect(((await (await detail()).json()) as { status: string }).status).toBe("available");
  expect(((await (await detail()).json()) as { status: string }).status).toBe("available");

  await signIn(request, baseURL!);
  const admin = await request.get(
    `/api/v1/admin/apartments?block=${first!.block.code}&q=${first!.number}`,
  );
  expect(admin.status()).toBe(200);
  const target = ((await admin.json()) as { items: Item[] }).items.find(
    (item) => item.slug === slug,
  );
  expect(target).toBeTruthy();
  const url = `/api/v1/admin/apartments/${target!.id}`;

  try {
    const patched = await request.patch(url, { data: { status: "reserved" } });
    expect(patched.status()).toBe(200);
    expect(((await patched.json()) as Item).status).toBe("reserved");

    expect(((await (await detail()).json()) as { status: string }).status).toBe("reserved");
    const reserved = await request.get(`/api/v1/apartments?status=reserved&pageSize=100`);
    const slugs = ((await reserved.json()) as { items: Array<{ slug: string }> }).items.map(
      (item) => item.slug,
    );
    expect(slugs).toContain(slug);

    const invalid = await request.patch(url, { data: { status: "gone" } });
    expect(invalid.status()).toBe(422);
    expect(await invalid.json()).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "The request has invalid fields.",
        fields: { status: [expect.any(String)] },
      },
    });
  } finally {
    const restored = await request.patch(url, { data: { status: "available" } });
    expect(restored.status()).toBe(200);
  }
  expect(((await (await detail()).json()) as { status: string }).status).toBe("available");
});

test("a lead from a public form is stored", async ({ request }) => {
  const response = await request.post("/api/v1/leads", {
    data: {
      type: "callback",
      name: "E2E Test",
      phone: "+994501234567",
      locale: "az",
      sourcePath: "/elaqe",
    },
  });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  expect(id).toEqual(expect.any(String));

  // Leave no test lead in a database the sales team might look at.
  const { db, close } = connect(databaseUrl());
  try {
    const [row] = await db.delete(leads).where(eq(leads.id, id)).returning();
    expect(row).toMatchObject({ type: "callback", sourcePath: "/elaqe", locale: "az" });
  } finally {
    await close();
  }
});
