import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apartmentListQuerySchema, type ApartmentListParams } from "@/shared/apartments";
import { leadSubmissionSchema } from "@/shared/leads";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));

// The session check is tested against the database (tests/db); here a header
// stands in for it.
vi.mock("@/lib/auth/session", () => ({
  authorize: async (request: Request) => {
    const role = request.headers.get("x-test-role");
    if (!role) {
      return {
        response: Response.json({ error: { code: "UNAUTHORIZED", message: "x" } }, { status: 401 }),
      };
    }
    return { user: { id: "u1", name: "Test", email: "t@example.com", role } };
  },
}));

const { handler, searchParams } = await import("@/lib/api/handler");
const { HttpError, notFound } = await import("@/lib/api/errors");

const url = "http://localhost/api/v1/things";

function post(body: string, type = "application/json") {
  return new Request(url, { method: "POST", headers: { "content-type": type }, body });
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: { code: string; fields?: Record<string, string[]> } })
    .error;
}

describe("handler()", () => {
  const echo = handler(
    {
      params: z.object({ id: z.uuid() }),
      query: z.object({ tags: z.array(z.string()).optional(), page: z.coerce.number().optional() }),
      body: z.object({ name: z.string().min(2), nested: z.object({ count: z.int() }) }),
      status: 201,
    },
    ({ params, query, body }) => ({ params, query, body }),
  );
  const id = "6f1c8f9e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";
  const context = { params: Promise.resolve({ id }) };

  it("parses params, query and body and answers JSON with the given status", async () => {
    const request = new Request(`${url}/${id}?tags=a&tags=b&page=2`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "ok", nested: { count: 1 } }),
    });
    const response = await echo(request, context);
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      params: { id },
      query: { tags: ["a", "b"], page: 2 },
      body: { name: "ok", nested: { count: 1 } },
    });
  });

  it("answers an invalid body with 422 and fields by dotted path", async () => {
    const response = await echo(
      post(JSON.stringify({ name: "x", nested: { count: 1.5 } })),
      context,
    );
    expect(response.status).toBe(422);
    const error = await errorOf(response);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(error.fields ?? {}).sort()).toEqual(["name", "nested.count"]);
  });

  it("answers a body that is not JSON with 415, or broken JSON with 400", async () => {
    expect((await echo(post("name=x", "text/plain"), context)).status).toBe(415);
    const broken = await echo(post("{"), context);
    expect(broken.status).toBe(400);
    expect((await errorOf(broken)).code).toBe("MALFORMED_JSON");
  });

  it("answers invalid params with 404 and an invalid query with 400", async () => {
    const body = JSON.stringify({ name: "ok", nested: { count: 1 } });
    const params = await echo(post(body), { params: Promise.resolve({ id: "nope" }) });
    expect(params.status).toBe(404);
    const query = await echo(
      new Request(`${url}?page=x`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
      context,
    );
    expect(query.status).toBe(400);
    expect((await errorOf(query)).fields).toEqual({ page: [expect.any(String)] });
  });

  it("checks the session before reading anything", async () => {
    const guarded = handler({ auth: "user", body: z.object({ a: z.string() }) }, ({ user }) => ({
      role: user.role,
    }));
    expect((await guarded(post("{"))).status).toBe(401);
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-role": "sales" },
      body: JSON.stringify({ a: "b" }),
    });
    expect(await (await guarded(request)).json()).toEqual({ role: "sales" });
  });

  it("turns thrown errors into the shared shape", async () => {
    const run = (error: unknown) =>
      handler({}, () => {
        throw error;
      })(new Request(url));

    const missing = await run(notFound("No such thing."));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: { code: "NOT_FOUND", message: "No such thing." },
    });

    const teapot = await run(new HttpError(418, "TEAPOT", "Short and stout.", { a: ["b"] }));
    expect(await teapot.json()).toEqual({
      error: { code: "TEAPOT", message: "Short and stout.", fields: { a: ["b"] } },
    });

    // Drizzle wraps the driver's error in `cause`.
    const duplicate = await run(new Error("insert failed", { cause: { code: "23505" } }));
    expect(duplicate.status).toBe(409);

    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const crash = await run(new Error("secret detail"));
    expect(crash.status).toBe(500);
    expect(JSON.stringify(await crash.json())).not.toContain("secret detail");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("answers 204 when the handler returns nothing, and passes a Response through", async () => {
    expect((await handler({}, () => undefined)(new Request(url))).status).toBe(204);
    const custom = new Response("x", { status: 202 });
    expect(await handler({}, () => custom)(new Request(url))).toBe(custom);
  });
});

describe("the apartment list query", () => {
  it("reads what RTK Query sends: arrays comma-joined, undefined left out", () => {
    const params: ApartmentListParams = {
      rooms: [2, 3],
      status: ["available", "reserved"],
      block: ["a"],
      areaMin: 50.5,
      sort: "-area",
      page: 2,
    };
    // fetchBaseQuery's default serialiser.
    const wire = new URLSearchParams(params as unknown as Record<string, string>);
    const parsed = apartmentListQuerySchema.parse(
      searchParams(new URL(`http://localhost/api/v1/apartments?${wire}`)),
    );
    expect(parsed).toMatchObject({
      rooms: [2, 3],
      status: ["available", "reserved"],
      block: ["a"],
      areaMin: 50.5,
      sort: { field: "area", direction: "desc" },
      page: 2,
      pageSize: 24,
      locale: "az",
    });
  });

  it("has defaults and rejects reversed ranges", () => {
    expect(apartmentListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 24,
      locale: "az",
      rooms: [],
      block: [],
      status: [],
      sort: { field: "number", direction: "asc" },
    });
    const reversed = apartmentListQuerySchema.safeParse({ areaMin: "90", areaMax: "60" });
    expect(reversed.error?.issues.map((issue) => issue.path)).toEqual([["areaMax"]]);
    expect(apartmentListQuerySchema.safeParse({ floorMin: "3", floorMax: "2" }).success).toBe(
      false,
    );
  });
});

describe("the lead submission", () => {
  const base = {
    name: "Elvin",
    phone: "+994501234567",
    locale: "az",
    sourcePath: "/elaqe",
  };

  it("treats empty optional fields as not given", () => {
    const lead = leadSubmissionSchema.parse({ ...base, type: "callback", email: "", message: "" });
    expect(lead).not.toHaveProperty("email", "");
    expect(lead.email).toBeUndefined();
  });

  it("needs a date for a viewing only", () => {
    expect(leadSubmissionSchema.safeParse({ ...base, type: "inquiry" }).success).toBe(true);
    const viewing = leadSubmissionSchema.safeParse({ ...base, type: "viewing" });
    expect(viewing.error?.issues.map((issue) => issue.path)).toEqual([["preferredAt"]]);
    expect(
      leadSubmissionSchema.safeParse({
        ...base,
        type: "viewing",
        preferredAt: "2026-11-10T11:00:00+04:00",
      }).success,
    ).toBe(true);
  });
});
