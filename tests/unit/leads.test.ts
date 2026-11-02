import { describe, expect, it } from "vitest";

import { createRateLimiter } from "@/lib/rate-limit";
import { leadSubmissionSchema } from "@/shared/leads";
import { normalizePhone, phoneInputSchema } from "@/shared/phone";

describe("phone normalisation", () => {
  it.each([
    // Azerbaijani local notations
    ["050 123 45 67", "+994501234567"],
    ["0501234567", "+994501234567"],
    ["50 123 45 67", "+994501234567"],
    ["501234567", "+994501234567"],
    ["(012) 434 32 32", "+994124343232"],
    ["012-434-32-32", "+994124343232"],
    ["055.553.55.55", "+994555535555"],
    // Azerbaijani international notations
    ["+994 50 123 45 67", "+994501234567"],
    ["+994501234567", "+994501234567"],
    ["+994 (50) 123-45-67", "+994501234567"],
    ["+994 050 123 45 67", "+994501234567"],
    ["00994 50 123 45 67", "+994501234567"],
    ["994501234567", "+994501234567"],
    ["  050 123 45 67  ", "+994501234567"],
    // Other countries, with their code
    ["+7 912 345-67-89", "+79123456789"],
    ["+44 20 7946 0958", "+442079460958"],
    ["0090 212 555 12 34", "+902125551234"],
    ["+1 (212) 555-0100", "+12125550100"],
  ])("%s → %s", (input, e164) => {
    expect(normalizePhone(input)).toBe(e164);
  });

  it.each([
    "",
    "12345",
    "abc",
    "050 123 45 6",
    "050 123 45 678",
    "+994 50 123 45",
    "+994 0 123 45 67",
    "+0 123 456 789",
    "+1234567890123456",
    "050 123 45 67 ext 2",
    "+994 50 123 45 67+",
  ])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("is what the lead schema stores", () => {
    expect(phoneInputSchema.parse("(012) 434 32 32")).toBe("+994124343232");
    expect(phoneInputSchema.safeParse("12345").success).toBe(false);
  });
});

describe("the lead form's schema", () => {
  const base = {
    type: "callback",
    name: "Elvin",
    phone: "050 123 45 67",
    locale: "az",
    sourcePath: "/elaqe",
    consent: true,
  };
  const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

  it("needs the visitor's consent", () => {
    expect(leadSubmissionSchema.safeParse(base).success).toBe(true);
    for (const consent of [false, undefined, "on"]) {
      const result = leadSubmissionSchema.safeParse({ ...base, consent });
      expect(result.error?.issues.map((issue) => issue.path)).toEqual([["consent"]]);
    }
  });

  it("books a viewing only in the coming year", () => {
    const viewing = (preferredAt: string) =>
      leadSubmissionSchema.safeParse({ ...base, type: "viewing", preferredAt }).success;
    expect(viewing(hours(24))).toBe(true);
    expect(viewing("2030-01-15T11:00:00+04:00")).toBe(false);
    expect(viewing(hours(-1))).toBe(false);
  });

  it("carries the spam-defence fields without judging them", () => {
    const lead = leadSubmissionSchema.parse({
      ...base,
      website: "https://spam.example",
      startedAt: 1,
      sentAt: 2,
    });
    expect(lead).toMatchObject({ website: "https://spam.example", startedAt: 1, sentAt: 2 });
    expect(leadSubmissionSchema.safeParse({ ...base, startedAt: -1 }).success).toBe(false);
  });
});

describe("the rate limiter", () => {
  const minute = 60_000;

  it("lets five requests through in ten minutes and throttles the rest", () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 10 * minute });
    const start = 1_000_000;
    // Fifty requests in one minute from one address.
    const results = Array.from({ length: 50 }, (_, i) =>
      limiter.hit("203.0.113.7", start + (i * minute) / 50),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(5);
    expect(results.slice(5).every((result) => !result.ok)).toBe(true);
    const last = results.at(-1);
    expect(last?.ok === false && last.retryAfter).toBeGreaterThan(8 * 60);
    expect(last?.ok === false && last.retryAfter).toBeLessThanOrEqual(10 * 60);

    // Another address has its own window; this one opens again after ten minutes.
    expect(limiter.hit("203.0.113.8", start + minute).ok).toBe(true);
    expect(limiter.hit("203.0.113.7", start + 10 * minute).ok).toBe(true);
  });

  it("holds a bounded number of addresses", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: minute, maxKeys: 100 });
    for (let i = 0; i < 1000; i++) limiter.hit(`198.51.100.${i}`, i);
    expect(limiter.size).toBeLessThanOrEqual(100);
    // Expired windows go first: after a minute the map can be refilled.
    for (let i = 0; i < 100; i++) limiter.hit(`192.0.2.${i}`, 2 * minute);
    expect(limiter.size).toBeLessThanOrEqual(100);
    expect(limiter.hit("192.0.2.99", 2 * minute).ok).toBe(false);
  });
});
