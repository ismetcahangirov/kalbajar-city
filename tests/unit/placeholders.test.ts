import { describe, expect, it } from "vitest";

import * as data from "@/db/seed/data";
import { contactsFormSchema, contactsToForm, locationFormSchema } from "@/lib/admin/settings-forms";
import { placeholderField, placeholderLabel, sectionOfPath } from "@/lib/admin/settings-sections";
import { homeSectionContentSchemas } from "@/shared/home-sections";
import {
  changedPlaceholders,
  homeSectionScope,
  isBlankValue,
  sameValue,
} from "@/shared/placeholders";
import { settingsSchemas } from "@/shared/settings";

describe("placeholder paths", () => {
  const paths = ["contacts.address", "contacts.hours", "homeLocation.distances"];
  const before = {
    address: { az: "Kəlbəcər" },
    hours: { az: "10:00–19:00" },
    phones: ["+994124343232"],
  };

  it("are dropped only for the fields a save changes, in its own scope", () => {
    const after = { ...before, address: { az: "Kəlbəcər, Mərkəzi küçə 1" } };
    expect(changedPlaceholders(paths, "contacts", before, after)).toEqual(["contacts.address"]);
    expect(changedPlaceholders(paths, "socials", before, after)).toEqual([]);
    // A field cleared to nothing has changed too.
    expect(changedPlaceholders(paths, "contacts", before, { ...before, hours: null })).toEqual([
      "contacts.hours",
    ]);
  });

  it("compare values, not key order or a missing key against null", () => {
    expect(sameValue({ az: "a", en: "b" }, { en: "b", az: "a" })).toBe(true);
    expect(sameValue({ az: "a", en: null }, { az: "a" })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue({ lat: 40.1 }, { lat: 40.10001 })).toBe(false);
  });

  it("treat null, blanks and empty lists as empty", () => {
    for (const value of [null, undefined, "", "  ", [], { az: "", en: null }]) {
      expect(isBlankValue(value), JSON.stringify(value)).toBe(true);
    }
    for (const value of [0, false, "x", [1], { az: "x" }]) {
      expect(isBlankValue(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("name the location section's scope and the section that edits each path", () => {
    expect(homeSectionScope("location")).toBe("homeLocation");
    expect(sectionOfPath("contacts.address")?.href).toBe("/admin/ayarlar");
    expect(sectionOfPath("homeLocation.distances")?.href).toBe("/admin/ayarlar/yerlesme");
    expect(placeholderLabel("contacts.address")).toBe("Əlaqə · Ünvan");
    expect(placeholderField("contacts.unknown")).toBe("contacts.unknown");
  });

  it("cover every stand-in the seed writes, and each stand-in passes its schema", () => {
    for (const path of Object.keys(data.placeholderValues)) {
      expect(sectionOfPath(path), path).not.toBeNull();
      expect(placeholderField(path), path).not.toBe(path);
    }
    const stand = data.placeholderValues;
    expect(() =>
      settingsSchemas.contacts.parse({
        ...data.settings.contacts,
        address: stand["contacts.address"],
        coordinates: stand["contacts.coordinates"],
        hours: stand["contacts.hours"],
        email: stand["contacts.email"],
      }),
    ).not.toThrow();
    expect(() =>
      homeSectionContentSchemas.location.parse({
        ...data.homeSections.location,
        distances: stand["homeLocation.distances"],
        directions: stand["homeLocation.directions"],
      }),
    ).not.toThrow();
  });
});

describe("the contacts form", () => {
  const typed = contactsToForm(data.settings.contacts);

  it("reads typed phones, a decimal comma and blanks as the stored value", () => {
    const value = contactsFormSchema.parse({
      ...typed,
      phones: [{ number: "012 434 32 32" }, { number: "050 553 55 55" }],
      whatsapp: " ",
      email: "",
      address: { az: "Kəlbəcər", en: "", ru: "" },
      hours: { az: "", en: "", ru: "" },
      coordinates: { lat: "40,1053", lng: " 46.0389 " },
    });
    expect(value).toEqual({
      phones: ["+994124343232", "+994505535555"],
      whatsapp: null,
      email: null,
      address: { az: "Kəlbəcər", en: "", ru: "" },
      hours: null,
      coordinates: { lat: 40.1053, lng: 46.0389 },
    });
    expect(settingsSchemas.contacts.safeParse(value).success).toBe(true);
  });

  it("treats both coordinates blank as none, and one blank or out of range as an error", () => {
    const parse = (lat: string, lng: string) =>
      contactsFormSchema.safeParse({ ...typed, coordinates: { lat, lng } });
    expect(parse("", "").data?.coordinates).toBeNull();
    expect(parse("40.1", "").error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "coordinates.lng",
    ]);
    expect(parse("95", "46").error?.issues[0]?.message).toBe("settings.contacts.latRange");
  });

  it("asks for the Azerbaijani text when only a translation is typed", () => {
    const result = contactsFormSchema.safeParse({
      ...typed,
      address: { az: "", en: "Kalbajar", ru: "" },
    });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["address.az"]);
  });
});

describe("the location form", () => {
  it("reads minutes as typed and an empty directions text as none", () => {
    const value = locationFormSchema.parse({
      title: { az: "Yerləşmə", en: "", ru: "" },
      body: { az: "", en: "", ru: "" },
      mapMediaId: null,
      directions: { az: "", en: "", ru: "" },
      distances: [{ place: { az: "İstisu", en: "Istisu", ru: "" }, minutes: "40" }],
    });
    expect(value.directions).toBeNull();
    expect(value.distances).toEqual([
      { place: { az: "İstisu", en: "Istisu", ru: "" }, minutes: 40 },
    ]);
    expect(homeSectionContentSchemas.location.safeParse(value).success).toBe(true);
  });
});
