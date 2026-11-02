import { describe, expect, it } from "vitest";

import { leadWhatsappHref } from "@/lib/admin/lead-links";
import { leadListParams } from "@/lib/admin/lead-list";
import { isDay, readTableState, tableSearch, type TableUrlSpec } from "@/lib/admin/table-state";
import { csvCell, toCsv } from "@/lib/leads/csv";
import { adminLeadListQuerySchema, leadUpdateSchema } from "@/shared/leads";

describe("CSV cells", () => {
  it.each([
    ["plain", '"plain"'],
    ['say "hi"', '"say ""hi"""'],
    ["a;b", '"a;b"'],
    ["two\nlines", '"two\nlines"'],
    ["Əliyev Şəhriyar", '"Əliyev Şəhriyar"'],
    [null, '""'],
    [42, '"42"'],
  ])("quotes %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it.each([
    ["=1+1", `"'=1+1"`],
    ["+994501234567", `"'+994501234567"`],
    ["-2", `"'-2"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    ["\tcmd", `"'\tcmd"`],
    ["\rcmd", `"'\rcmd"`],
    ['=HYPERLINK("http://x")', `"'=HYPERLINK(""http://x"")"`],
  ])("prefixes a formula %j with an apostrophe", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("leaves a value that only contains a formula character alone", () => {
    expect(csvCell("a=b")).toBe('"a=b"');
  });

  it("builds a file with a BOM, semicolons and CRLF", () => {
    expect(
      toCsv([
        ["Ad", "Telefon"],
        ["Aysel", "+994"],
      ]),
    ).toBe('\uFEFF"Ad";"Telefon"\r\n"Aysel";"\'+994"\r\n');
  });
});

describe("the lead update schema", () => {
  const parse = (value: unknown) => leadUpdateSchema.safeParse(value);
  const fields = (value: unknown) => {
    const result = parse(value);
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
  };

  it("allows any status but lost without a reason", () => {
    expect(parse({ status: "closed" }).success).toBe(true);
    expect(parse({ status: "new" }).success).toBe(true);
    expect(fields({ status: "lost" })).toEqual(["lostReason"]);
    expect(fields({ status: "lost", lostReason: "" })).toEqual(["lostReason"]);
    expect(parse({ status: "lost", lostReason: " Too far " }).data).toEqual({
      status: "lost",
      lostReason: "Too far",
    });
  });

  it("takes a reason only with the lost status", () => {
    expect(fields({ status: "contacted", lostReason: "x" })).toEqual(["lostReason"]);
  });

  it("assigns to a user id or to nobody, and needs a change", () => {
    expect(parse({ assigneeId: null }).success).toBe(true);
    expect(parse({ assigneeId: "aB3_x-9" }).success).toBe(true);
    expect(parse({ assigneeId: "x'; drop table" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ status: "won" }).success).toBe(false);
    expect(parse({ status: "new", note: "x" }).success).toBe(false);
  });
});

describe("the lead list query", () => {
  it("reads lists, keywords and a range of days", () => {
    const query = adminLeadListQuerySchema.parse({
      status: "new,contacted",
      type: ["callback", "viewing"],
      assignee: "me,unassigned",
      source: "/elaqe",
      from: "2026-11-01",
      to: "2026-11-02",
      sort: "-createdAt",
    });
    expect(query).toMatchObject({
      status: ["new", "contacted"],
      type: ["callback", "viewing"],
      assignee: ["me", "unassigned"],
      source: ["/elaqe"],
      sort: { field: "createdAt", direction: "desc" },
    });
  });

  it("sorts newest first by default and refuses a reversed range", () => {
    expect(adminLeadListQuerySchema.parse({}).sort).toEqual({
      field: "createdAt",
      direction: "desc",
    });
    expect(
      adminLeadListQuerySchema.safeParse({ from: "2026-11-02", to: "2026-11-01" }).success,
    ).toBe(false);
    expect(adminLeadListQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
  });
});

describe("date filters in the URL", () => {
  const spec: TableUrlSpec = {
    sortFields: ["createdAt"],
    defaultSort: "-createdAt",
    filters: { status: ["new", "lost"], tarixden: isDay, tarixedek: isDay },
  };

  it("keeps one valid day and drops anything else", () => {
    const state = readTableState(
      new URLSearchParams("tarixden=2026-02-30,2026-11-01&tarixedek=yesterday&status=lost,new"),
      spec,
    );
    expect(state.filters).toEqual({ tarixden: ["2026-11-01"], status: ["new", "lost"] });
    expect(tableSearch(state, spec)).toBe("?status=new%2Clost&tarixden=2026-11-01");
  });

  it.each([
    ["2026-11-02", true],
    ["2024-02-29", true],
    ["2026-02-29", false],
    ["2026-1-2", false],
    ["", false],
  ])("isDay(%j) is %s", (value, expected) => {
    expect(isDay(value)).toBe(expected);
  });

  it("maps the Azerbaijani keys onto the API's, dropping a reversed range's end", () => {
    expect(
      leadListParams({
        page: 2,
        pageSize: 20,
        sort: "-createdAt",
        filters: {
          status: ["new"],
          nov: ["callback"],
          menbe: ["instagram"],
          menzil: ["a-12"],
          mesul: ["me"],
          tarixden: ["2026-11-02"],
          tarixedek: ["2026-11-01"],
        },
      }),
    ).toEqual({
      page: 2,
      pageSize: 20,
      sort: "-createdAt",
      status: ["new"],
      type: ["callback"],
      source: ["instagram"],
      apartment: ["a-12"],
      assignee: ["me"],
      from: "2026-11-02",
      to: undefined,
    });
  });
});

describe("the WhatsApp link", () => {
  it("opens a chat with the number and a greeting by first name", () => {
    const href = leadWhatsappHref("+994501234567", "Aysel Məmmədova");
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://wa.me/994501234567");
    expect(url.searchParams.get("text")).toMatch(/^Salam, Aysel!/);
  });
});
