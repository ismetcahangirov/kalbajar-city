import { describe, expect, it } from "vitest";

import * as data from "@/db/seed/data";
import { demoInventoryPlan, layoutSlug } from "@/db/seed";
import { localize } from "@/i18n/content";
import { locales } from "@/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";
import { homeSectionContentSchemas, homeSectionKeys } from "@/shared/home-sections";
import { areaSchema } from "@/shared/inventory";
import { paragraphs, translatableRichTextSchema } from "@/shared/rich-text";
import { settingsKeys, settingsSchemas } from "@/shared/settings";
import { translatableSchema } from "@/shared/translatable";

describe("localize() over stored translatable fields", () => {
  const complete = { az: "Mənzil", en: "Apartment", ru: "Квартира" };
  const azOnly = translatableSchema.parse({ az: "Mənzil", en: "  ", ru: null });

  it.each(locales)("returns the %s translation when it exists", (locale) => {
    expect(localize(complete, locale)).toEqual({
      value: complete[locale],
      locale,
      fallback: false,
    });
  });

  it.each(locales)("falls back to az for %s when only az is stored", (locale) => {
    expect(localize(azOnly, locale)).toEqual({
      value: "Mənzil",
      locale: "az",
      fallback: locale !== "az",
    });
  });
});

describe("translatable schemas", () => {
  it("requires az and trims the others", () => {
    expect(translatableSchema.safeParse({ en: "Apartment" }).success).toBe(false);
    expect(translatableSchema.safeParse({ az: "   " }).success).toBe(false);
    expect(translatableSchema.parse({ az: " Mənzil ", en: " Apartment " })).toEqual({
      az: "Mənzil",
      en: "Apartment",
    });
  });

  it("accepts an editor document per locale", () => {
    const body = { az: paragraphs("Salam"), en: null };
    expect(translatableRichTextSchema.parse(body)).toEqual(body);
    expect(translatableRichTextSchema.safeParse({ az: { type: "paragraph" } }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("transliterates every Azerbaijani letter", () => {
    expect(slugify("Əğışçöü ƏĞIŞÇÖÜ")).toBe("egiscou-egiscou");
    expect(slugify("İnteryer")).toBe("interyer");
  });

  it("keeps ASCII words and digits and collapses punctuation", () => {
    expect(slugify("  3 otaq — 111.79 m²! ")).toBe("3-otaq-111-79-m2");
    expect(slugify("Kəlbəcər şəhəri")).toBe("kelbecer-seheri");
  });

  it("caps the length without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(95)} b`);
    expect(slug.length).toBeLessThanOrEqual(96);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("suffixes a taken slug", () => {
    expect(uniqueSlug("bina", new Set(["bina", "bina-2"]))).toBe("bina-3");
    expect(uniqueSlug("bina", new Set())).toBe("bina");
  });
});

describe("area values", () => {
  it("accept at most two decimals and must be positive", () => {
    expect(areaSchema.safeParse("62.09").success).toBe(true);
    expect(areaSchema.safeParse("22634").success).toBe(true);
    expect(areaSchema.safeParse("62.095").success).toBe(false);
    expect(areaSchema.safeParse("0").success).toBe(false);
    expect(areaSchema.safeParse("62,09").success).toBe(false);
  });
});

describe("seed data", () => {
  it("validates every settings value and home section", () => {
    for (const key of settingsKeys) {
      expect(() => settingsSchemas[key].parse(data.settings[key]), key).not.toThrow();
    }
    for (const key of homeSectionKeys) {
      expect(() => homeSectionContentSchemas[key].parse(data.homeSections[key]), key).not.toThrow();
    }
  });

  it("has the ten published layouts, rooms adding up to less than the total", () => {
    expect(data.layouts).toHaveLength(10);
    expect(data.layouts.map((l) => l.areaTotal)).toEqual([
      "62.09",
      "74.40",
      "102.17",
      "104.33",
      "106.22",
      "111.79",
      "121.92",
      "142.79",
      "150.62",
      "186.90",
    ]);
    for (const layout of data.layouts) {
      const rooms = layout.roomAreas.reduce((sum, room) => sum + Number(room.area), 0);
      expect(rooms, layout.areaTotal).toBeLessThan(Number(layout.areaTotal));
      expect(layout.roomAreas.filter((room) => room.kind === "bedroom")).toHaveLength(
        layout.rooms - 1,
      );
    }
    expect(new Set(data.layouts.map(layoutSlug)).size).toBe(data.layouts.length);
  });

  it("plans a demo inventory matching the published totals", () => {
    const plan = demoInventoryPlan();
    const { complex } = data.settings;
    expect(plan.buildings).toHaveLength(complex.buildings);
    expect(plan.blocks).toHaveLength(complex.blocks);
    expect(plan.apartments).toHaveLength(complex.apartments);
    expect(new Set(plan.apartments.map((a) => a.slug)).size).toBe(plan.apartments.length);
    expect(plan.apartments.every((a) => slugify(a.slug) === a.slug)).toBe(true);
    expect(new Set(plan.apartments.map((a) => a.status))).toEqual(
      new Set(["available", "reserved", "sold", "not_for_sale"]),
    );
  });

  it("has every translatable seed value in all three locales", () => {
    const walk = (value: unknown, path: string): string[] => {
      if (Array.isArray(value)) return value.flatMap((item, i) => walk(item, `${path}[${i}]`));
      if (value && typeof value === "object") {
        if ("az" in value) {
          return locales
            .filter((l) => !(value as Record<string, unknown>)[l])
            .map((l) => `${path}.${l}`);
        }
        return Object.entries(value).flatMap(([k, v]) => walk(v, `${path}.${k}`));
      }
      return [];
    };
    expect(
      walk([data.settings, data.homeSections, data.faq, data.galleryCategories], "seed"),
    ).toEqual([]);
  });
});
