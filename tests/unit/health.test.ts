import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  it("reports ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
