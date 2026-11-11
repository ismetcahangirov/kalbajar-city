import { afterEach, describe, expect, it, vi } from "vitest";

import { clientIp, clientKey, trustedClientIpHeader, unknownClientKey } from "@/lib/http/client-ip";
import { createRateLimiter } from "@/lib/rate-limit";

const cloudflare = { TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip" };

describe("client IP without a trusted header (development, CI)", () => {
  it("reads the first X-Forwarded-For entry, then X-Real-IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), {})).toBe(
      "203.0.113.7",
    );
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }), {})).toBe("203.0.113.8");
    expect(clientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }), {})).toBe("2001:db8::1");
    expect(clientIp(new Headers(), {})).toBeNull();
    expect(clientIp(null, {})).toBeNull();
  });

  it("treats an empty variable as unset", () => {
    expect(trustedClientIpHeader({ TRUSTED_CLIENT_IP_HEADER: "" })).toBeNull();
    expect(trustedClientIpHeader({})).toBeNull();
  });

  it("ignores a value that is not an IP address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "<script>, 10.0.0.1" }), {})).toBeNull();
    expect(
      clientIp(new Headers({ "x-forwarded-for": "nonsense", "x-real-ip": "203.0.113.8" }), {}),
    ).toBe("203.0.113.8");
  });
});

describe("client IP behind Cloudflare (TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("reads Cloudflare's header", () => {
    const headers = new Headers({ "cf-connecting-ip": "198.51.100.4" });
    expect(clientIp(headers, cloudflare)).toBe("198.51.100.4");
  });

  it("ignores a spoofed X-Forwarded-For and X-Real-IP", () => {
    // What reaches the app when a client sends `X-Forwarded-For: 203.0.113.9`:
    // Cloudflare appends the real address and sets its own header.
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 198.51.100.4",
      "x-real-ip": "203.0.113.9",
      "cf-connecting-ip": "198.51.100.4",
    });
    expect(clientIp(headers, cloudflare)).toBe("198.51.100.4");
  });

  it("treats a missing header as unknown, never falling back to X-Forwarded-For", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9" });
    expect(clientIp(headers, cloudflare)).toBeNull();
    expect(clientKey(headers, cloudflare)).toBe(unknownClientKey);
  });

  it("rejects a header value that is not one IP address", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const value of ["203.0.113.9, 198.51.100.4", "localhost", "999.1.1.1", "unknown"]) {
      expect(clientIp(new Headers({ "cf-connecting-ip": value }), cloudflare)).toBeNull();
    }
  });

  it("limits clients with an unknown IP together instead of exempting them", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const results = ["203.0.113.1", "203.0.113.2", "203.0.113.3"].map((spoofed) =>
      limiter.hit(clientKey(new Headers({ "x-forwarded-for": spoofed }), cloudflare), 0),
    );
    expect(results.map((result) => result.ok)).toEqual([true, true, false]);
  });

  it("normalises the header name and reads process.env by default", () => {
    vi.stubEnv("TRUSTED_CLIENT_IP_HEADER", " CF-Connecting-IP ");
    expect(trustedClientIpHeader()).toBe("cf-connecting-ip");
    expect(clientIp(new Headers({ "cf-connecting-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("refuses a variable that is not a header name", () => {
    expect(() => trustedClientIpHeader({ TRUSTED_CLIENT_IP_HEADER: "cf connecting ip" })).toThrow(
      /TRUSTED_CLIENT_IP_HEADER/,
    );
    expect(() =>
      clientIp(new Headers(), { TRUSTED_CLIENT_IP_HEADER: "x-real-ip: 1.2.3.4" }),
    ).toThrow(/TRUSTED_CLIENT_IP_HEADER/);
  });
});
