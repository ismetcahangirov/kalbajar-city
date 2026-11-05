import { hashPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";

import { auditActionLabel, auditEntityLabel, auditValueText } from "@/lib/admin/audit-labels";
import { auditListParams, auditFilterKeys } from "@/lib/admin/audit-list";
import { isSecretField, redactText, redactValue } from "@/lib/audit-redact";
import { adminAuditListQuerySchema, auditChanges, auditRedacted } from "@/shared/audit";

describe("audit redaction", () => {
  it("hides secret fields by name, whatever the case or separators, and keeps the name", () => {
    for (const name of [
      "password",
      "passwordHash",
      "password_hash",
      "PASSWORD",
      "token",
      "accessToken",
      "refresh_token",
      "resetTokenValue",
      "clientSecret",
      "api_key",
      "apiKey",
      "privateKey",
      "AWS_ACCESS_KEY_ID",
      "authorization",
      "cookie",
      "Set-Cookie",
      "hash",
      "salt",
    ]) {
      expect(isSecretField(name), name).toBe(true);
      expect(redactValue({ [name]: "s3cret-value" })).toEqual({ [name]: auditRedacted });
    }
  });

  it("leaves the fields the log really holds alone", () => {
    const row = {
      id: "0193f2c4-6c1e-7d6a-9a3b-5f2c8f7e1a10",
      name: "Aysel",
      email: "aysel@example.com",
      role: "editor",
      key: "contacts",
      status: "sold",
      priceMinor: "12500000",
      areaSqm: "62.09",
      blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
      cookieNotice: true,
      banExpires: "2026-11-02T00:00:00.000Z",
      storageKey: "media/2026/11/plan.webp",
      url: "https://kalbajarcity.com/menziller?otaq=2",
      title: { az: "Basic plan", en: "Basic information about the block" },
      order: ["a", "b"],
      published: false,
      count: 3,
      nothing: null,
    };
    expect(redactValue(row)).toEqual(row);
  });

  it("hides nested secrets, in objects and arrays, and a whole object under a secret name", () => {
    expect(
      redactValue({
        account: { password: "hunter2", providerId: "credential" },
        sessions: [{ token: "abc", ipAddress: "203.0.113.7" }],
        credentials: { user: "a", pass: "b" },
      }),
    ).toEqual({
      account: { password: auditRedacted, providerId: "credential" },
      sessions: [{ token: auditRedacted, ipAddress: "203.0.113.7" }],
      credentials: auditRedacted,
    });
  });

  it("keeps an empty secret field empty, and leaves a change visible", () => {
    expect(redactValue({ password: null })).toEqual({ password: null });
    expect(redactValue({ password: "" })).toEqual({ password: auditRedacted });
    expect(redactValue({ token: 0 })).toEqual({ token: auditRedacted });
  });

  it("finds a real Better Auth password hash under an innocent name", async () => {
    const hash = await hashPassword("a passphrase that is long");
    expect(redactValue({ note: hash })).toEqual({ note: auditRedacted });
    expect(redactText(`moved from ${hash} today`)).toBe(`moved from ${auditRedacted} today`);
  });

  it("finds secrets inside any text", () => {
    const bcrypt = `$2b$10$${"a".repeat(53)}`;
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl";
    const cases: Array<[string, string]> = [
      [bcrypt, auditRedacted],
      ["$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA", auditRedacted],
      ["$scrypt$n=16384$c2FsdA$aGFzaA", auditRedacted],
      [jwt, auditRedacted],
      ["Bearer abcdefghijklmnopqrstuvwx", `Bearer ${auditRedacted}`],
      ["/reset?token=abc123&lang=az", `/reset?token=${auditRedacted}&lang=az`],
      ["https://s3/x?X-Amz-Signature=abc", `https://s3/x?X-Amz-Signature=${auditRedacted}`],
      ['{"password":"hunter2","a":1}', `{"password":"${auditRedacted}","a":1}`],
      ["password: hunter2", `password: ${auditRedacted}`],
      ["postgres://kc:pw123@db:5432/kc", `postgres://kc:${auditRedacted}@db:5432/kc`],
      ["reset-password:Ab12Cd34", `reset-password:${auditRedacted}`],
      ["-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----", auditRedacted],
    ];
    for (const [text, expected] of cases) expect(redactText(text), text).toBe(expected);
    expect(redactValue({ deep: [{ text: jwt }] })).toEqual({ deep: [{ text: auditRedacted }] });
    expect(redactValue({ [jwt]: 1 })).toEqual({ [auditRedacted]: 1 });
  });

  it("does not take ordinary text for a secret", () => {
    for (const text of [
      "0193f2c4-6c1e-7d6a-9a3b-5f2c8f7e1a10",
      "Basic information about the block",
      "Şifrəsini dəyişdi",
      "https://kalbajarcity.com/menziller",
      "2026-11-02T00:00:00.000Z",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ]) {
      expect(redactText(text)).toBe(text);
    }
  });

  it("stays quick on a very long text", () => {
    const long = "a".repeat(2_000_000);
    const started = performance.now();
    expect(redactText(long)).toBe(long);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("audit entry fields", () => {
  it("keeps what audit() stored: changed fields, a whole side, or nothing", () => {
    expect(auditChanges({ before: { a: 1 }, after: { a: 2 } })).toEqual([
      { field: "a", before: 1, after: 2 },
    ]);
    expect(auditChanges({ before: null, after: { a: 1 } })).toEqual([{ field: "a", after: 1 }]);
    expect(auditChanges({ before: { a: 1 }, after: null })).toEqual([{ field: "a", before: 1 }]);
    expect(auditChanges({ before: null, after: null })).toEqual([]);
  });

  it("tells a field missing on one side from a null one", () => {
    const [first, second] = auditChanges({ before: { a: null }, after: { a: 1, b: 2 } });
    expect(first).toEqual({ field: "a", before: null, after: 1 });
    expect(second).toEqual({ field: "b", after: 2 });
    expect(Object.hasOwn(second!, "before")).toBe(false);
  });
});

describe("audit values on screen", () => {
  it("shows instants in Baku time, at any depth", () => {
    expect(auditValueText("2026-11-02T20:30:00.000Z")).toBe("03.11.2026, 00:30");
    expect(auditValueText({ at: "2026-11-02T20:30:00.000Z" })).toContain("03.11.2026, 00:30");
    // A plain day is not an instant, so no zone applies.
    expect(auditValueText("2026-11-02")).toBe("2026-11-02");
  });

  it("shows other values as stored, and the redaction marker in words", () => {
    expect(auditValueText("Aysel")).toBe("Aysel");
    expect(auditValueText(false)).toBe("false");
    expect(auditValueText("")).toBe("");
    expect(auditValueText({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}');
    expect(auditValueText(`token=${auditRedacted}`)).toBe("token=[gizlədilib]");
  });

  it("names every action and entity, and one it does not know as stored", () => {
    expect(auditActionLabel("news.publish")).toBe("Xəbəri dərc etdi");
    expect(auditActionLabel("thing.frobnicate")).toContain("thing.frobnicate");
    expect(auditEntityLabel("apartment")).toBe("Mənzil");
    expect(auditEntityLabel("thing")).toBe("thing");
  });
});

describe("audit list query", () => {
  it("defaults to newest first and reads several values per filter", () => {
    const query = adminAuditListQuerySchema.parse({ actor: "system,abc", entityType: "user" });
    expect(query.sort).toEqual({ field: "createdAt", direction: "desc" });
    expect(query.actor).toEqual(["system", "abc"]);
    expect(query.entityType).toEqual(["user"]);
  });

  it("refuses a bad day, a range the wrong way round and an oversized page", () => {
    for (const bad of [
      { from: "02.11.2026" },
      { from: "2026-11-03", to: "2026-11-02" },
      { pageSize: "101" },
      { sort: "action" },
      { entityType: "Robert'); DROP" },
    ]) {
      expect(adminAuditListQuerySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("maps the URL's filters to the endpoint, dropping a range the wrong way round", () => {
    const params = auditListParams({
      page: 2,
      pageSize: 20,
      sort: "-createdAt",
      filters: {
        [auditFilterKeys.actor]: ["system"],
        [auditFilterKeys.entityType]: ["user"],
        [auditFilterKeys.entityId]: [" abc "],
        [auditFilterKeys.from]: ["2026-11-03"],
        [auditFilterKeys.to]: ["2026-11-02"],
      },
      view: undefined,
    } as Parameters<typeof auditListParams>[0]);
    expect(params).toEqual({
      page: 2,
      pageSize: 20,
      sort: "-createdAt",
      actor: ["system"],
      entityType: ["user"],
      entityId: "abc",
      from: "2026-11-03",
      to: undefined,
    });
  });
});
