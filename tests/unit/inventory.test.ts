import { describe, expect, it } from "vitest";

import { apiErrorMessage } from "@/lib/admin/api-error";
import {
  apartmentBulkSchema,
  apartmentFormSchema,
  applyBulkChange,
  changesPrice,
  toApartmentBody,
} from "@/shared/apartments";
import { CsvError, detectSeparator, guardFormula, parseCsv, writeCsv } from "@/shared/csv";
import {
  areaInputSchema,
  aznToMinor,
  blockCodeSchema,
  layoutTypeCreateSchema,
  layoutTypeUpdateSchema,
  minorToAzn,
} from "@/shared/inventory";
import {
  inventoryCsv,
  parseInventoryCsv,
  parseStatusWord,
  type InventoryCsvSource,
} from "@/shared/inventory-csv";

const fields = (text: string) => parseCsv(text).map((record) => record.fields);

describe("CSV reader and writer (RFC 4180)", () => {
  it("reads quoted separators, doubled quotes and line breaks inside quotes", () => {
    expect(fields('a,"b,c","say ""hi""","two\nlines"\r\nx,y,z,w\n')).toEqual([
      ["a", "b,c", 'say "hi"', "two\nlines"],
      ["x", "y", "z", "w"],
    ]);
  });

  it("reports each record's first line, skipping blank lines", () => {
    const records = parseCsv('h1,h2\n\n"a\nb",c\nd,e');
    expect(records.map((record) => record.line)).toEqual([1, 3, 5]);
  });

  it("strips a byte order mark and detects ; or , from the header", () => {
    expect(detectSeparator("﻿Blok;Mərtəbə;Mənzil")).toBe(";");
    expect(detectSeparator('"a;b",c,d')).toBe(",");
    expect(fields("﻿a;b\n1,5;2")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
  });

  it("throws on a quote left open, with its line", () => {
    expect(() => parseCsv('a,b\n"open,c\nd')).toThrow(CsvError);
    try {
      parseCsv('a,b\n"open,c\nd');
    } catch (error) {
      expect((error as CsvError).line).toBe(2);
    }
  });

  it("writes what it reads back, with a BOM and CRLF", () => {
    const rows = [
      ["a;b", 'q"q', "line\nbreak", "plain"],
      ["1", "", "x", "y"],
    ];
    const text = writeCsv(rows, ";");
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain("\r\n");
    expect(fields(text)).toEqual(rows);
  });

  it("guards text cells against formulas", () => {
    expect(["=SUM(A1)", "+1", "-A", "@x", "A"].map(guardFormula)).toEqual([
      "'=SUM(A1)",
      "'+1",
      "'-A",
      "'@x",
      "A",
    ]);
  });
});

describe("prices in AZN", () => {
  it("reads manat as typed into qəpik", () => {
    expect(
      ["125000", "125 000", "125 000,50", "99999.5", "1 234 567,05 ₼", "0", " "].map(aznToMinor),
    ).toEqual(["12500000", "12500000", "12500050", "9999950", "123456705", "0", null]);
  });

  it("refuses what is not a price rather than guessing", () => {
    for (const text of ["125,000", "12.5.0", "abc", "-5", "1,2,3", "1.234,5"]) {
      expect(aznToMinor(text), text).toBeUndefined();
    }
  });

  it("writes qəpik back as a person types it", () => {
    expect([
      minorToAzn("12500000"),
      minorToAzn("9999950"),
      minorToAzn("5"),
      minorToAzn(null),
    ]).toEqual(["125000", "99999,50", "0,05", ""]);
  });

  it("turns the apartment form's AZN into the API's qəpik", () => {
    const values = apartmentFormSchema.parse({
      floorId: "00000000-0000-4000-8000-000000000001",
      layoutTypeId: "00000000-0000-4000-8000-000000000002",
      number: "101",
      areaTotal: "62,09",
      status: "available",
      price: "125 000,50",
    });
    expect(toApartmentBody(values)).toMatchObject({
      areaTotal: "62.09",
      priceMinor: "12500050",
    });
    expect(toApartmentBody({ ...values, price: null }).priceMinor).toBeNull();
  });
});

describe("inventory fields", () => {
  it("reads areas with a decimal comma and block codes in either case", () => {
    expect(areaInputSchema.parse("62,09")).toBe("62.09");
    expect(areaInputSchema.safeParse("62,091").success).toBe(false);
    expect(blockCodeSchema.parse(" a ")).toBe("A");
  });

  it("reads a layout typed into the form: numbers as text, a blank description as none", () => {
    const layout = layoutTypeCreateSchema.parse({
      code: "3-111",
      rooms: "3",
      areaTotal: "111,15",
      roomAreas: [{ kind: "living", area: "20,5" }],
      description: { az: " ", en: "", ru: "" },
      sortOrder: "5",
    });
    expect(layout).toMatchObject({
      rooms: 3,
      areaTotal: "111.15",
      roomAreas: [{ kind: "living", area: "20.5" }],
      description: null,
      sortOrder: 5,
    });
    // An update leaves out what it does not send, rather than resetting it to a default.
    expect(layoutTypeUpdateSchema.parse({ code: "3-112" })).toEqual({ code: "3-112" });
    expect(layoutTypeCreateSchema.safeParse({ code: "x", rooms: "", areaTotal: "1" }).success).toBe(
      false,
    );
  });
});

describe("bulk changes", () => {
  const apartment = (status: "available" | "not_for_sale" | "sold", priceMinor: string | null) => ({
    status,
    priceMinor,
  });

  it("publishes only what is not for sale, and unpublishes anything", () => {
    expect(applyBulkChange(apartment("not_for_sale", null), { kind: "publish" }).status).toBe(
      "available",
    );
    expect(applyBulkChange(apartment("sold", null), { kind: "publish" }).status).toBe("sold");
    expect(applyBulkChange(apartment("sold", null), { kind: "unpublish" }).status).toBe(
      "not_for_sale",
    );
  });

  it("changes prices by a percentage to the nearest qəpik, leaving unpriced ones", () => {
    const change = (percent: number) => ({ kind: "pricePercent" as const, percent });
    expect(applyBulkChange(apartment("available", "12500000"), change(5)).priceMinor).toBe(
      "13125000",
    );
    expect(applyBulkChange(apartment("available", "12345"), change(-2.5)).priceMinor).toBe("12036");
    expect(applyBulkChange(apartment("available", "999"), change(0.1)).priceMinor).toBe("1000");
    expect(applyBulkChange(apartment("available", null), change(10)).priceMinor).toBeNull();
    expect(
      applyBulkChange(apartment("available", "100"), { kind: "priceSet", priceMinor: "500" }),
    ).toEqual({ status: "available", priceMinor: "500" });
  });

  it("knows which changes touch prices, and validates the request", () => {
    expect(changesPrice({ kind: "status", status: "sold" })).toBe(false);
    expect(changesPrice({ kind: "pricePercent", percent: 3 })).toBe(true);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      apartmentBulkSchema.safeParse({ ids: [id, id], change: { kind: "publish" } }).success,
    ).toBe(false);
    expect(
      apartmentBulkSchema.safeParse({ ids: [id], change: { kind: "pricePercent", percent: 0 } })
        .success,
    ).toBe(false);
    expect(
      apartmentBulkSchema.safeParse({ ids: [id], change: { kind: "pricePercent", percent: 1.234 } })
        .success,
    ).toBe(false);
  });
});

describe("the apartments CSV", () => {
  const source: InventoryCsvSource[] = [
    {
      block: "A",
      floor: 1,
      number: "101",
      layout: "3-111",
      areaTotal: "111.15",
      status: "available",
      priceMinor: "12500050",
    },
    {
      block: "-B",
      floor: -1,
      number: "01",
      layout: "2-62",
      areaTotal: "62.00",
      status: "not_for_sale",
      priceMinor: null,
    },
  ];

  it("exports what it imports, as Azerbaijani Excel writes it", () => {
    const text = inventoryCsv(source);
    expect(text.split("\r\n")[0]).toBe("﻿Blok;Mərtəbə;Mənzil;Plan;Sahə (m²);Status;Qiymət (AZN)");
    expect(text).toContain("A;1;101;3-111;111,15;satışda;125000,50");
    // Text that starts with "-" is guarded in the file and restored on import; numbers are not.
    expect(text).toContain("'-B;-1;01;2-62;62,00;satışda deyil;");
    const { rows, issues } = parseInventoryCsv(text);
    expect(issues).toEqual([]);
    expect(rows).toEqual([
      { line: 2, ...source[0], areaTotal: "111.15" },
      { line: 3, ...source[1], areaTotal: "62.00" },
    ]);
  });

  it("accepts headers in any order and language, comma-separated, and status words", () => {
    const text = [
      "number,block,floor,price_azn,status,layout,area,notes",
      '12A,c,3,"99 999,50",Satılıb,1-45,45.5,corner',
      "7,C,3,,rezerv,1-45,45,",
    ].join("\n");
    const { rows, issues } = parseInventoryCsv(text);
    expect(issues).toEqual([]);
    expect(
      rows.map(({ block, number, status, priceMinor }) => [block, number, status, priceMinor]),
    ).toEqual([
      ["C", "12A", "sold", "9999950"],
      ["C", "7", "reserved", null],
    ]);
    expect(
      ["satışda", "SATISDA", "satışda deyil", "available", "not_for_sale"].map(parseStatusWord),
    ).toEqual(["available", "available", "not_for_sale", "available", "not_for_sale"]);
  });

  it("reports every invalid row with its line and column, and duplicates", () => {
    const text = [
      "Blok;Mərtəbə;Mənzil;Plan;Sahə (m²);Status;Qiymət (AZN)",
      "A;1;101;3-111;111,15;satışda;",
      "A;x;102;3-111;0;sold out;12,345",
      "A;1;101;3-111;111,15;rezerv;",
      "A!;1;103;3-111;50;satılıb;100",
    ].join("\n");
    const { rows, issues, total } = parseInventoryCsv(text);
    expect(total).toBe(4);
    expect(rows.map((row) => row.line)).toEqual([2]);
    expect(issues.map(({ line, column, code }) => [line, column, code])).toEqual([
      [3, "floor", "floor_format"],
      [3, "area", "area_format"],
      [3, "status", "status_unknown"],
      [3, "price", "price_format"],
      [4, "number", "duplicate"],
      [5, "block", "block_format"],
    ]);
  });

  it("reports a missing column, an empty file and a broken quote", () => {
    expect(parseInventoryCsv("Blok;Mərtəbə\nA;1").issues.map((issue) => issue.column)).toEqual([
      "number",
      "layout",
      "area",
      "status",
      "price",
    ]);
    expect(parseInventoryCsv("Blok;Mərtəbə").issues[0]?.code).toBe("empty_file");
    expect(parseInventoryCsv('Blok;"Mərtəbə\nA;1').issues[0]?.code).toBe("csv_malformed");
  });
});

describe("console messages for inventory errors", () => {
  it("says what still depends on a row that cannot be deleted", () => {
    const error = {
      status: 409,
      data: { error: { code: "IN_USE", message: "x", dependents: { floors: 4 } } },
    };
    expect(apiErrorMessage(error)).toBe(
      "Silmək olmaz: buna bağlı 4 mərtəbə var. Əvvəlcə onları silin və ya köçürün.",
    );
  });
});
