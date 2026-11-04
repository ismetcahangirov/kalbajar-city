import { describe, expect, it } from "vitest";

import { roomLabels } from "@/components/apartments/area-table";
import { formatPrice, formatPricePerArea } from "@/i18n/format";
import { apartmentListQuerySchema, withPriceVisibility } from "@/shared/apartments";
import {
  activeGroups,
  isIndexableCatalogue,
  pageWindow,
  parseCatalogueParams,
  toApartmentListParams,
  toApartmentListQuery,
  toCatalogueQuery,
  withoutGroup,
  withoutHiddenPrices,
} from "@/shared/catalogue";

const NBSP = " ";
const options = { locale: "az" as const, pageSize: 12, pricesVisible: true };

describe("parseCatalogueParams", () => {
  it("maps every Azerbaijani key to the catalogue state", () => {
    expect(
      parseCatalogueParams({
        otaq: ["3", "2"],
        "sahe-min": "60,5",
        "sahe-max": "120",
        blok: "a,c",
        "mertebe-min": "2",
        "mertebe-max": "4",
        status: ["satisda", "rezerv"],
        "qiymet-min": "100000",
        "qiymet-max": "250000",
        sira: "-qiymet",
        sehife: "3",
        gorunus: "siyahi",
      }),
    ).toEqual({
      rooms: [2, 3],
      areaMin: 60.5,
      areaMax: 120,
      blocks: ["A", "C"],
      floorMin: 2,
      floorMax: 4,
      statuses: ["available", "reserved"],
      priceMin: 100_000,
      priceMax: 250_000,
      sort: "-qiymet",
      page: 3,
      view: "list",
    });
  });

  it("drops unknown keys and invalid values instead of failing", () => {
    expect(
      parseCatalogueParams({
        otaq: ["two", "0", "11", "2", "2"],
        "sahe-min": "-5",
        "sahe-max": "abc",
        blok: "A;drop table",
        "mertebe-min": "1.5",
        status: ["sold", "satilib"],
        "qiymet-min": "1e9",
        sira: "price",
        sehife: "0",
        gorunus: "cards",
        rooms: "3",
        utm_source: "instagram",
      }),
    ).toEqual({
      rooms: [2],
      areaMin: undefined,
      areaMax: undefined,
      blocks: [],
      floorMin: undefined,
      floorMax: undefined,
      statuses: ["sold"],
      priceMin: undefined,
      priceMax: undefined,
      sort: undefined,
      page: 1,
      view: "grid",
    });
  });

  it("drops a maximum below its minimum", () => {
    const state = parseCatalogueParams({ "sahe-min": "100", "sahe-max": "60", "mertebe-max": "3" });
    expect(state).toMatchObject({ areaMin: 100, areaMax: undefined, floorMax: 3 });
  });

  it("round-trips through the URL query in a fixed order, leaving defaults out", () => {
    const state = parseCatalogueParams({
      sira: "sahe",
      otaq: "2,3",
      status: "satilib",
      blok: "B",
      sehife: "1",
      gorunus: "siyahi",
    });
    const query = toCatalogueQuery(state);
    expect(Object.keys(query)).toEqual(["otaq", "blok", "status", "sira", "gorunus"]);
    expect(query).toEqual({
      otaq: ["2", "3"],
      blok: ["B"],
      status: ["satilib"],
      sira: "sahe",
      gorunus: "siyahi",
    });
    expect(parseCatalogueParams(query)).toEqual(state);
    expect(toCatalogueQuery(parseCatalogueParams({}))).toEqual({});
  });
});

describe("toApartmentListQuery", () => {
  it("builds the loader's query, prices in minor units", () => {
    const state = parseCatalogueParams({
      otaq: "2",
      blok: "a",
      status: "satisda",
      "sahe-min": "60",
      "qiymet-max": "150000",
      sira: "-sahe",
      sehife: "2",
    });
    const query = toApartmentListQuery(state, options);
    expect(query).toEqual({
      page: 2,
      pageSize: 12,
      locale: "az",
      rooms: [2],
      block: ["A"],
      status: ["available"],
      areaMin: 60,
      priceMax: 15_000_000,
      sort: { field: "area", direction: "desc" },
    });
    // The same query the API would parse from its own keys.
    expect(
      apartmentListQuerySchema.parse({
        page: "2",
        pageSize: "12",
        rooms: "2",
        block: "A",
        status: "available",
        areaMin: "60",
        priceMax: "15000000",
        sort: "-area",
      }),
    ).toEqual(query);
  });

  it("sorts naturally by default", () => {
    expect(toApartmentListQuery(parseCatalogueParams({}), options).sort).toEqual({
      field: "number",
      direction: "asc",
    });
  });

  it("gives the client-side count the same filters", () => {
    const state = parseCatalogueParams({ otaq: "1,2", "qiymet-min": "90000", sira: "qiymet" });
    expect(toApartmentListParams(state)).toEqual({
      rooms: [1, 2],
      priceMin: 9_000_000,
      sort: "price",
    });
  });
});

describe("price visibility", () => {
  const query = apartmentListQuerySchema.parse({
    priceMin: "100",
    priceMax: "900",
    sort: "-price",
    rooms: "2",
  });

  it("keeps the price filter and sort while prices are public", () => {
    expect(withPriceVisibility(query, true)).toBe(query);
  });

  it("ignores them while prices are hidden, falling back to the natural order", () => {
    const hidden = withPriceVisibility(query, false);
    expect(hidden).not.toHaveProperty("priceMin");
    expect(hidden).not.toHaveProperty("priceMax");
    expect(hidden.sort).toEqual({ field: "number", direction: "asc" });
    expect(hidden.rooms).toEqual([2]);
    // Another sort is left alone.
    const byArea = apartmentListQuerySchema.parse({ priceMin: "1", sort: "area" });
    expect(withPriceVisibility(byArea, false).sort).toEqual({ field: "area", direction: "asc" });
  });

  it("applies in the catalogue's mapping and keeps hidden prices out of its URLs", () => {
    const state = parseCatalogueParams({ "qiymet-min": "1000", sira: "-qiymet", otaq: "3" });
    const hidden = toApartmentListQuery(state, { ...options, pricesVisible: false });
    expect(hidden).not.toHaveProperty("priceMin");
    expect(hidden.sort.field).toBe("number");
    expect(toCatalogueQuery(withoutHiddenPrices(state, false))).toEqual({ otaq: ["3"] });
    expect(toCatalogueQuery(withoutHiddenPrices(state, true))).toEqual({
      otaq: ["3"],
      "qiymet-min": "1000",
      sira: "-qiymet",
    });
  });
});

describe("isIndexableCatalogue", () => {
  it.each([
    [{}, true],
    [{ otaq: "2" }, true],
    [{ otaq: "2", utm_source: undefined }, true],
    [{ otaq: "2,3" }, false],
    [{ otaq: ["2", "3"] }, false],
    [{ otaq: "two" }, false],
    [{ otaq: "2", sehife: "2" }, false],
    [{ blok: "A" }, false],
    [{ gorunus: "siyahi" }, false],
    [{ utm_source: "instagram" }, false],
  ])("%j → %s", (params, indexable) => {
    expect(isIndexableCatalogue(params)).toBe(indexable);
  });
});

describe("the empty state's relaxations", () => {
  it("lists active groups and clears one at a time", () => {
    const state = parseCatalogueParams({ otaq: "5", "sahe-min": "300", blok: "A" });
    expect(activeGroups(state)).toEqual(["rooms", "area", "blocks"]);
    expect(withoutGroup(state, "area")).toMatchObject({
      rooms: [5],
      areaMin: undefined,
      blocks: ["A"],
    });
    expect(withoutGroup(state, "rooms").rooms).toEqual([]);
  });
});

describe("pageWindow", () => {
  it("shows the ends and the neighbourhood of the current page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
    expect(pageWindow(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageWindow(12, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
  });
});

describe("roomLabels", () => {
  it("numbers kinds that repeat, in order", () => {
    const labels = roomLabels(
      [
        { kind: "living", area: "20" },
        { kind: "bedroom", area: "15" },
        { kind: "bedroom", area: "12" },
        { kind: "balcony", area: "4" },
      ],
      (kind) => kind,
      (name, number) => `${name} ${number}`,
    );
    expect(labels).toEqual(["living", "bedroom 1", "bedroom 2", "balcony"]);
  });
});

describe("formatPrice", () => {
  it("formats minor-unit strings per locale with the currency code", () => {
    expect(formatPrice("15000000", "AZN", "az")).toBe(`150${NBSP}000${NBSP}AZN`);
    expect(formatPrice("15000000", "AZN", "en")).toBe(`150,000${NBSP}AZN`);
    expect(formatPrice("15000050", "AZN", "ru")).toBe(`150${NBSP}000,50${NBSP}AZN`);
    expect(formatPrice("12345678901234", "AZN", "az")).toBe(
      `123${NBSP}456${NBSP}789${NBSP}012,34${NBSP}AZN`,
    );
  });
});

describe("formatPricePerArea", () => {
  it("divides the price by the area and rounds to whole manat", () => {
    expect(formatPricePerArea("15000000", "AZN", 72.5, "az")).toBe(`2${NBSP}069${NBSP}AZN/m²`);
    expect(formatPricePerArea("15000000", "AZN", 72.5, "en")).toBe(`2,069${NBSP}AZN/m²`);
    expect(formatPricePerArea("15000000", "AZN", 72.5, "ru")).toBe(`2${NBSP}069${NBSP}AZN/м²`);
    expect(formatPricePerArea("15000000", "AZN", 0, "az")).toBeNull();
  });
});
