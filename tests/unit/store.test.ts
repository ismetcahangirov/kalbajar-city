import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeStore } from "@/store";
import { adminApartmentsApi } from "@/store/endpoints/admin-apartments";
import { adminMediaApi } from "@/store/endpoints/admin-media";
import { adminSelectorApi } from "@/store/endpoints/admin-selector";
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

  it("shows a status change at once and undoes it when the server refuses", async () => {
    const store = makeStore();
    const args = { status: ["available" as const] };
    const list = store.dispatch(adminApartmentsApi.endpoints.adminApartments.initiate(args));
    await list;
    const cached = () =>
      adminApartmentsApi.endpoints.adminApartments.select(args)(store.getState()).data?.items[0]
        ?.status;

    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    patchAnswer = Response.json({ error: { code: "FORBIDDEN", message: "No." } }, { status: 403 });
    vi.stubGlobal("fetch", async (request: Request) => {
      if (request.method !== "PATCH") throw new Error("only the write is expected");
      await gate;
      return patchAnswer.clone();
    });

    const update = store.dispatch(
      adminApartmentsApi.endpoints.updateApartment.initiate({ id: "a1", status: "reserved" }),
    );
    await vi.waitFor(() => expect(cached()).toBe("reserved"));
    release();
    await update;
    expect(cached()).toBe("available");
    list.unsubscribe();
  });

  it("refreshes the selector editor after inventory and media edits made elsewhere", async () => {
    const view = {
      level: "block",
      id: "b1",
      picture: { id: "m1", url: null, previewUrl: null, width: 1, height: 1, alt: "Facade" },
      hotspots: [],
    };
    vi.stubGlobal("fetch", async (request: Request) => {
      const { pathname, search } = new URL(request.url);
      calls.push(`${request.method} ${pathname}${search}`);
      if (pathname === "/api/v1/admin/selector") return Response.json(view);
      if (pathname === "/api/v1/admin/selector/picture") return Response.json(view);
      return Response.json({ id: "m1" });
    });
    const store = makeStore();
    const editor = store.dispatch(
      adminSelectorApi.endpoints.selectorView.initiate({ block: "b1" }),
    );
    const library = store.dispatch(adminMediaApi.endpoints.adminMedia.initiate("m2"));
    await Promise.all([editor, library]);

    for (const write of [
      () => store.dispatch(adminApartmentsApi.endpoints.deleteApartment.initiate("a1")),
      () =>
        store.dispatch(
          adminMediaApi.endpoints.updateMedia.initiate({ id: "m1", alt: { az: "Fasad" } }),
        ),
    ]) {
      calls = [];
      await write();
      await vi.waitFor(() => expect(calls).toContain("GET /api/v1/admin/selector?block=b1"));
    }

    // Setting a picture changes the usages of the old and the new one.
    calls = [];
    await store.dispatch(
      adminSelectorApi.endpoints.setSelectorPicture.initiate({
        level: "block",
        id: "b1",
        mediaId: "m2",
      }),
    );
    await vi.waitFor(() => expect(calls).toContain("GET /api/v1/admin/media/m2"));
    editor.unsubscribe();
    library.unsubscribe();
  });

  it("reads no error from a network failure", () => {
    expect(apiErrorOf({ status: "FETCH_ERROR", error: "TypeError: failed" })).toBeNull();
    expect(apiErrorOf(undefined)).toBeNull();
  });
});
