import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeStore } from "@/store";
import { adminApartmentsApi } from "@/store/endpoints/admin-apartments";
import { apartmentsApi } from "@/store/endpoints/apartments";
import { apiErrorOf } from "@/store/errors";

const apartment = {
  id: "a1",
  slug: "blok-a-menzil-101",
  number: "101",
  status: "available",
  areaTotal: "68.40",
  priceMinor: null,
  currency: "AZN",
  isDemo: true,
  floor: 1,
  block: "A",
  layout: { code: "2-68", rooms: 2 },
  updatedAt: "2026-11-02T10:00:00.000Z",
};

let calls: string[] = [];
let patchAnswer: Response;

beforeEach(() => {
  calls = [];
  patchAnswer = Response.json({ ...apartment, status: "sold" });
  // fetchBaseQuery builds a Request from "/api/v1/..."; Node needs an origin.
  vi.stubGlobal(
    "Request",
    class extends Request {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(typeof input === "string" ? new URL(input, "http://localhost") : input, init);
      }
    },
  );
  vi.stubGlobal("fetch", async (request: Request) => {
    const { pathname, search } = new URL(request.url);
    calls.push(`${request.method} ${pathname}${search}`);
    if (request.method === "PATCH") return patchAnswer.clone();
    if (pathname.startsWith("/api/v1/apartments/")) return Response.json({ ...apartment });
    return Response.json({ items: [apartment], page: 1, pageSize: 24, total: 1, pageCount: 1 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the store", () => {
  it("is a new store each time, so requests never share a cache", () => {
    expect(makeStore()).not.toBe(makeStore());
    expect(makeStore().getState()).toHaveProperty("api");
  });

  it("refetches open lists and the public view after an apartment changes", async () => {
    const store = makeStore();
    const list = store.dispatch(
      adminApartmentsApi.endpoints.adminApartments.initiate({ status: ["available", "sold"] }),
    );
    const detail = store.dispatch(
      apartmentsApi.endpoints.apartment.initiate({ slug: apartment.slug, locale: "en" }),
    );
    await Promise.all([list, detail]);
    expect(calls.sort()).toEqual([
      "GET /api/v1/admin/apartments?status=available%2Csold",
      "GET /api/v1/apartments/blok-a-menzil-101?locale=en",
    ]);

    calls = [];
    const update = await store.dispatch(
      adminApartmentsApi.endpoints.updateApartment.initiate({ id: "a1", status: "sold" }),
    );
    expect(update.data?.status).toBe("sold");
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[0]).toBe("PATCH /api/v1/admin/apartments/a1");
    expect(calls.slice(1).sort()).toEqual([
      "GET /api/v1/admin/apartments?status=available%2Csold",
      "GET /api/v1/apartments/blok-a-menzil-101?locale=en",
    ]);
    list.unsubscribe();
    detail.unsubscribe();
  });

  it("refetches nothing after a failed write and exposes the shared error", async () => {
    const store = makeStore();
    const list = store.dispatch(adminApartmentsApi.endpoints.adminApartments.initiate());
    await list;
    calls = [];
    patchAnswer = Response.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "The request has invalid fields.",
          fields: { status: ["Invalid option"] },
        },
      },
      { status: 422 },
    );
    const update = await store.dispatch(
      adminApartmentsApi.endpoints.updateApartment.initiate({ id: "a1", status: "sold" }),
    );
    expect(apiErrorOf(update.error)).toEqual({
      code: "VALIDATION_FAILED",
      message: "The request has invalid fields.",
      fields: { status: ["Invalid option"] },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toEqual(["PATCH /api/v1/admin/apartments/a1"]);
    list.unsubscribe();
  });

  it("reads no error from a network failure", () => {
    expect(apiErrorOf({ status: "FETCH_ERROR", error: "TypeError: failed" })).toBeNull();
    expect(apiErrorOf(undefined)).toBeNull();
  });
});
