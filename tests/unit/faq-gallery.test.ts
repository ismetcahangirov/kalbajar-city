import { describe, expect, it } from "vitest";

import { describeUsage } from "@/lib/admin/media-list";
import { faqCreateSchema, faqUpdateSchema } from "@/shared/faq";
import {
  galleryCategoryCreateSchema,
  galleryCategoryUpdateSchema,
  galleryItemCreateSchema,
  galleryItemFormSchema,
} from "@/shared/gallery";
import { move, orderSchema, sameMembers } from "@/shared/ordering";

const a = "0b4f8f0e-7d1a-4c55-9b9e-2f7a3c1d5e61";
const b = "0b4f8f0e-7d1a-4c55-9b9e-2f7a3c1d5e62";
const c = "0b4f8f0e-7d1a-4c55-9b9e-2f7a3c1d5e63";

describe("move", () => {
  it("moves an item down and up without touching the input", () => {
    const list = ["a", "b", "c", "d"];
    expect(move(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(move(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps a target past either end and ignores a missing source", () => {
    expect(move(["a", "b"], 0, 9)).toEqual(["b", "a"]);
    expect(move(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("orderSchema and sameMembers", () => {
  it("refuses an id given twice", () => {
    expect(orderSchema.safeParse({ ids: [a, a] }).success).toBe(false);
    expect(orderSchema.safeParse({ ids: [a, b] }).success).toBe(true);
  });

  it("accepts only the same rows, in any order", () => {
    expect(sameMembers([a, b, c], [c, a, b])).toBe(true);
    expect(sameMembers([a, b, c], [a, b])).toBe(false);
    expect(sameMembers([a, b], [a, c])).toBe(false);
  });
});

describe("faq schemas", () => {
  it("requires the Azerbaijani question and answer and publishes by default", () => {
    const parsed = faqCreateSchema.parse({
      question: { az: " Sual? " },
      answer: { az: "Cavab.", en: "" },
    });
    expect(parsed).toMatchObject({ question: { az: "Sual?" }, status: "published" });
    expect(faqCreateSchema.safeParse({ question: { az: "" }, answer: { az: "x" } }).success).toBe(
      false,
    );
  });

  it("bounds the answer's length and needs a change to update", () => {
    const long = { question: { az: "Sual" }, answer: { az: "x".repeat(4001) } };
    expect(faqCreateSchema.safeParse(long).success).toBe(false);
    expect(faqUpdateSchema.safeParse({}).success).toBe(false);
    expect(faqUpdateSchema.safeParse({ status: "draft" }).success).toBe(true);
  });
});

describe("gallery schemas", () => {
  it("treats a blank category slug as none, so the server makes one", () => {
    expect(galleryCategoryCreateSchema.parse({ name: { az: "Interyer" }, slug: "" }).slug).toBe(
      undefined,
    );
    expect(
      galleryCategoryCreateSchema.safeParse({ name: { az: "x" }, slug: "Bad Slug" }).success,
    ).toBe(false);
    expect(galleryCategoryUpdateSchema.parse({ slug: "interyer" })).toEqual({ slug: "interyer" });
  });

  it("creates published image items unless told otherwise", () => {
    expect(galleryItemCreateSchema.parse({ categoryId: a, mediaId: b }).status).toBe("published");
  });

  it("turns a blank caption into none and wants Azerbaijani before a translation", () => {
    const base = { categoryId: a, mediaId: b, status: "draft" as const };
    expect(
      galleryItemFormSchema.parse({ ...base, caption: { az: "", en: "", ru: "" } }).caption,
    ).toBe(null);
    expect(
      galleryItemFormSchema.parse({ ...base, caption: { az: "Lobbi", en: "" } }).caption,
    ).toMatchObject({ az: "Lobbi" });
    const result = galleryItemFormSchema.safeParse({ ...base, caption: { az: "", en: "Lobby" } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["caption", "az"]);
  });
});

describe("media usages", () => {
  it("links a gallery item to the gallery screen", () => {
    expect(
      describeUsage({ entityType: "gallery_item", entityId: a, field: "media", label: null }).href,
    ).toBe("/admin/xeberler/qalereya");
  });
});
