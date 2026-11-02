import { describe, expect, it } from "vitest";

import {
  nextSort,
  readTableState,
  tableSearch,
  withFilter,
  withoutFilters,
  withPage,
  withSort,
  type TableUrlSpec,
} from "@/lib/admin/table-state";

const spec: TableUrlSpec = {
  sortFields: ["number", "area", "floor"],
  defaultSort: "number",
  filters: {
    status: ["available", "reserved", "sold", "not_for_sale"],
    blok: ["A", "B", "C"],
    otaq: ["1", "2", "3"],
  },
};

const read = (search: string) => readTableState(new URLSearchParams(search), spec);

describe("table URL state", () => {
  it("reads the defaults from an empty query", () => {
    expect(read("")).toEqual({ page: 1, sort: "number", filters: {} });
  });

  it("reads page, sort and filters, comma-separated or repeated", () => {
    expect(read("?sehife=3&sira=-area&status=sold,available&otaq=2&otaq=3")).toEqual({
      page: 3,
      sort: "-area",
      filters: { status: ["available", "sold"], otaq: ["2", "3"] },
    });
  });

  it("drops what it does not know instead of failing", () => {
    expect(read("?sehife=-2&sira=-price&status=gone,sold&blok=Z&foo=1")).toEqual({
      page: 1,
      sort: "number",
      filters: { status: ["sold"] },
    });
    expect(read("?sehife=1.5&sira=").page).toBe(1);
  });

  it("writes defaults out, so the plain list has a plain URL", () => {
    expect(tableSearch({ page: 1, sort: "number", filters: {} }, spec)).toBe("");
    expect(
      tableSearch({ page: 2, sort: "-floor", filters: { blok: ["A", "C"], otaq: [] } }, spec),
    ).toBe("?blok=A%2CC&sira=-floor&sehife=2");
  });

  it("round-trips through the URL", () => {
    const state = { page: 4, sort: "area", filters: { status: ["reserved"], blok: ["B"] } };
    expect(read(tableSearch(state, spec))).toEqual(state);
  });

  it("starts from the first page when filters or the order change", () => {
    const state = { page: 5, sort: "number", filters: { status: ["sold"] } };
    expect(withFilter(state, "blok", ["A"])).toEqual({
      page: 1,
      sort: "number",
      filters: { status: ["sold"], blok: ["A"] },
    });
    expect(withFilter(state, "status", [])).toEqual({ page: 1, sort: "number", filters: {} });
    expect(withoutFilters(state).filters).toEqual({});
    expect(withSort(state, "-area")).toEqual({ ...state, sort: "-area", page: 1 });
    expect(withPage(state, 0).page).toBe(1);
    expect(withPage(state, 6).filters).toEqual(state.filters);
  });

  it("toggles a column ascending, then descending", () => {
    expect(nextSort("number", "area")).toBe("area");
    expect(nextSort("area", "area")).toBe("-area");
    expect(nextSort("-area", "area")).toBe("area");
  });
});
