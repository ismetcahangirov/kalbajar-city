import { describe, expect, it } from "vitest";

import { localize, missingTranslations } from "@/i18n/content";
import { formatArea, formatNumber, formatPhone, telHref } from "@/i18n/format";

const NBSP = " ";

describe("formatNumber", () => {
  it("groups Azerbaijani thousands with a no-break space and keeps the decimal comma", () => {
    expect(formatNumber(22634, "az")).toBe(`22${NBSP}634`);
    expect(formatNumber(22634.5, "az", { maximumFractionDigits: 1 })).toBe(`22${NBSP}634,5`);
  });

  it("uses a no-break space in Russian and a comma in English", () => {
    expect(formatNumber(22634, "ru")).toBe(`22${NBSP}634`);
    expect(formatNumber(22634, "en")).toBe("22,634");
  });
});

describe("formatArea", () => {
  it("formats square metres per locale", () => {
    expect(formatArea(62.09, "az")).toBe(`62,09${NBSP}m²`);
    expect(formatArea(62.09, "en")).toBe(`62.09${NBSP}m²`);
    expect(formatArea(22634, "ru")).toBe(`22${NBSP}634${NBSP}м²`);
  });
});

describe("phone numbers", () => {
  it("spaces an Azerbaijani number", () => {
    expect(formatPhone("+994501234567")).toBe(["+994", "50", "123", "45", "67"].join(NBSP));
    expect(formatPhone("+994 (50) 123-45-67")).toBe(formatPhone("+994501234567"));
  });

  it("leaves other numbers as given", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });

  it("builds a tel: href from any notation", () => {
    expect(telHref("+994 50 123 45 67")).toBe("tel:+994501234567");
  });
});

describe("translatable content", () => {
  const field = { az: "Mənzil", en: "Apartment", ru: "" };

  it("returns the requested translation", () => {
    expect(localize(field, "en")).toEqual({ value: "Apartment", locale: "en", fallback: false });
  });

  it("falls back to Azerbaijani and says so", () => {
    expect(localize(field, "ru")).toEqual({ value: "Mənzil", locale: "az", fallback: true });
  });

  it("lists the gaps for the console", () => {
    expect(missingTranslations({ title: field, body: { az: "Mətn", en: null } })).toEqual([
      { field: "title", locale: "ru" },
      { field: "body", locale: "en" },
      { field: "body", locale: "ru" },
    ]);
  });
});
