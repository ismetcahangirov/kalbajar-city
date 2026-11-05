import { describe, expect, it } from "vitest";

import {
  lengthStatus,
  localePath,
  normalizeOverridePath,
  seoOverrideCreateSchema,
} from "@/shared/seo-overrides";

const parse = (body: Record<string, unknown>) =>
  seoOverrideCreateSchema.safeParse({ title: { az: "Başlıq" }, ...body });

describe("SEO override paths", () => {
  it("keys a page the way overrideKey() does", () => {
    expect(normalizeOverridePath(" /menziller/ ")).toBe("/menziller");
    expect(normalizeOverridePath("/m%65nziller")).toBe("/menziller");
    expect(normalizeOverridePath("/")).toBe("/");
    expect(normalizeOverridePath("/menziller?otaq=2")).toBe("/menziller?otaq=2");
    expect(normalizeOverridePath("/menziller/?")).toBe("/menziller");
  });

  it("refuses locale prefixes, console and API paths, and malformed paths", () => {
    for (const path of ["/en/menziller", "/ru", "/admin/seo", "/api/v1/apartments"]) {
      expect(parse({ path }).error?.issues[0]?.message).toBe("seo.error.reserved");
    }
    expect(parse({ path: "menziller" }).error?.issues[0]?.message).toBe("seo.error.slash");
    expect(parse({ path: "//host" }).error?.issues[0]?.message).toBe("seo.error.slash");
    expect(parse({ path: "/a b" }).error?.issues[0]?.message).toBe("seo.error.characters");
    // overrideKey() percent-encodes non-ASCII, so a decoded one could never match a page.
    for (const path of ["/xebərlər", "/xeb%C9%99rl%C9%99r", "/menziller?blok=ə"]) {
      expect(parse({ path }).error?.issues[0]?.message).toBe("seo.error.characters");
    }
    // A word that merely starts like a locale is a page.
    expect(parse({ path: "/english-page" }).success).toBe(true);
  });
});

describe("SEO override bodies", () => {
  it("fills blank languages and defaults", () => {
    expect(parse({ path: "/elaqe" }).data).toEqual({
      path: "/elaqe",
      title: { az: "Başlıq", en: "", ru: "" },
      description: { az: "", en: "", ru: "" },
      ogMediaId: null,
      noindex: false,
    });
  });

  it("allows an English-only override and refuses one that changes nothing", () => {
    expect(parse({ path: "/elaqe", title: { en: "Contact" } }).success).toBe(true);
    const empty = parse({ path: "/elaqe", title: {} });
    expect(empty.error?.issues[0]).toMatchObject({
      message: "seo.error.empty",
      path: ["title", "az"],
    });
    expect(parse({ path: "/elaqe", title: {}, noindex: true }).success).toBe(true);
  });

  it("saves a long text but refuses pasted junk", () => {
    expect(parse({ path: "/elaqe", title: { az: "a".repeat(120) } }).success).toBe(true);
    expect(parse({ path: "/elaqe", title: { az: "a".repeat(201) } }).success).toBe(false);
  });
});

describe("length warnings", () => {
  it("warns past what a search result shows", () => {
    expect(lengthStatus("  ", "title")).toBe("empty");
    expect(lengthStatus("a".repeat(60), "title")).toBe("ok");
    expect(lengthStatus("a".repeat(61), "title")).toBe("long");
    expect(lengthStatus("a".repeat(161), "description")).toBe("long");
  });

  it("previews the address with the locale prefix", () => {
    expect(localePath("/", "az")).toBe("/");
    expect(localePath("/", "en")).toBe("/en");
    expect(localePath("/elaqe", "ru")).toBe("/ru/elaqe");
  });
});
