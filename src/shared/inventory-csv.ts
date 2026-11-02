import { z } from "zod";

import { slugify } from "@/lib/slug";

import { apartmentNumberSchema } from "./apartments";
import { guardFormula, parseCsv, unguardFormula, writeCsv, CsvError } from "./csv";
import {
  aznToMinor,
  areaInputSchema,
  blockCodeSchema,
  floorNumberSchema,
  layoutCodeSchema,
  minorToAzn,
  type ApartmentStatus,
} from "./inventory";

/**
 * The apartments CSV (#24): one row per apartment, the columns below in any
 * order. The header may be written in Azerbaijani, with or without its
 * letters (`Mərtəbə`, `mertebe`), or in English (`floor`).
 */
export const csvColumns = [
  { key: "block", header: "Blok", names: ["blok", "block", "blok kodu", "block code"] },
  { key: "floor", header: "Mərtəbə", names: ["mertebe", "floor"] },
  { key: "number", header: "Mənzil", names: ["menzil", "menzil nomresi", "number", "apartment"] },
  { key: "layout", header: "Plan", names: ["plan", "plan kodu", "layout", "layout code"] },
  { key: "area", header: "Sahə (m²)", names: ["sahe", "sahe m2", "area", "area m2"] },
  { key: "status", header: "Status", names: ["status"] },
  {
    key: "price",
    header: "Qiymət (AZN)",
    names: ["qiymet", "qiymet azn", "price", "price azn"],
  },
] as const;

export type CsvColumn = (typeof csvColumns)[number]["key"];

/** Status words a file may use: the console's Azerbaijani ones, or the API's. */
const statusWords: Record<string, ApartmentStatus> = {
  satisda: "available",
  "satisda-deyil": "not_for_sale",
  rezerv: "reserved",
  "rezerv-edilib": "reserved",
  satilib: "sold",
  available: "available",
  reserved: "reserved",
  sold: "sold",
  "not-for-sale": "not_for_sale",
};

/** How an export writes each status: the words the console shows. */
export const statusWord: Record<ApartmentStatus, string> = {
  available: "satışda",
  reserved: "rezerv",
  sold: "satılıb",
  not_for_sale: "satışda deyil",
};

export function parseStatusWord(value: string): ApartmentStatus | undefined {
  return statusWords[slugify(value)];
}

export const maxImportRows = 2000;

/** What can be wrong with a file or one of its rows; the console words each code. */
export const importIssueCodes = [
  "csv_malformed",
  "empty_file",
  "too_many_rows",
  "header_missing",
  "header_duplicate",
  "block_format",
  "floor_format",
  "number_format",
  "layout_format",
  "area_format",
  "status_unknown",
  "price_format",
  "duplicate",
  "block_unknown",
  "layout_unknown",
  "ambiguous",
] as const;

export type ImportIssueCode = (typeof importIssueCodes)[number];

/** A problem, on the file's line (1-based) and, where it belongs to one, a column. */
export type ImportIssue = {
  line: number;
  column: CsvColumn | null;
  code: ImportIssueCode;
  /** The value as written, for the message. */
  value?: string;
};

/** A row that reads correctly; whether its block and layout exist is the server's check. */
export type InventoryCsvRow = {
  line: number;
  block: string;
  floor: number;
  number: string;
  layout: string;
  areaTotal: string;
  status: ApartmentStatus;
  priceMinor: string | null;
};

const fieldSchemas = {
  block: blockCodeSchema,
  floor: floorNumberSchema,
  number: apartmentNumberSchema,
  layout: layoutCodeSchema,
  area: areaInputSchema,
} satisfies Partial<Record<CsvColumn, z.ZodType>>;

const formatCodes = {
  block: "block_format",
  floor: "floor_format",
  number: "number_format",
  layout: "layout_format",
  area: "area_format",
} as const satisfies Record<keyof typeof fieldSchemas, ImportIssueCode>;

/** The column each header names, or `null` for one the importer does not know. */
function columnOf(header: string): CsvColumn | null {
  const name = slugify(header);
  if (!name) return null;
  const column = csvColumns.find((candidate) =>
    candidate.names.some((alias) => slugify(alias) === name),
  );
  return column?.key ?? null;
}

/**
 * Reads a file into rows, reporting every row that does not read, with its
 * line. Unknown columns are ignored, so a file may carry notes of its own.
 */
export function parseInventoryCsv(text: string): {
  /** Data rows in the file, valid or not. */
  total: number;
  rows: InventoryCsvRow[];
  issues: ImportIssue[];
} {
  let records;
  try {
    records = parseCsv(text);
  } catch (error) {
    const line = error instanceof CsvError ? error.line : 1;
    return { total: 0, rows: [], issues: [{ line, column: null, code: "csv_malformed" }] };
  }
  const [header, ...body] = records;
  if (!header || !body.length) {
    return {
      total: 0,
      rows: [],
      issues: [{ line: header?.line ?? 1, column: null, code: "empty_file" }],
    };
  }
  if (body.length > maxImportRows) {
    return {
      total: body.length,
      rows: [],
      issues: [
        { line: header.line, column: null, code: "too_many_rows", value: String(body.length) },
      ],
    };
  }

  const issues: ImportIssue[] = [];
  const positions = new Map<CsvColumn, number>();
  header.fields.forEach((name, index) => {
    const column = columnOf(name);
    if (!column) return;
    if (positions.has(column)) {
      issues.push({ line: header.line, column, code: "header_duplicate", value: name });
    } else positions.set(column, index);
  });
  for (const { key } of csvColumns) {
    if (!positions.has(key))
      issues.push({ line: header.line, column: key, code: "header_missing" });
  }
  if (issues.length) return { total: body.length, rows: [], issues };

  const rows: InventoryCsvRow[] = [];
  const seen = new Map<string, number>();
  for (const record of body) {
    // A missing cell reads as empty: some tools drop a trailing empty price.
    const cell = (column: CsvColumn) =>
      unguardFormula((record.fields[positions.get(column)!] ?? "").trim());
    const rowIssues: ImportIssue[] = [];
    const read = <K extends keyof typeof fieldSchemas>(column: K) => {
      const parsed = fieldSchemas[column].safeParse(cell(column));
      if (!parsed.success) {
        rowIssues.push({
          line: record.line,
          column,
          code: formatCodes[column],
          value: cell(column),
        });
        return undefined;
      }
      return parsed.data as z.output<(typeof fieldSchemas)[K]>;
    };
    const block = read("block");
    const floor = read("floor");
    const number = read("number");
    const layout = read("layout");
    const areaTotal = read("area");
    const status = parseStatusWord(cell("status"));
    if (!status) {
      rowIssues.push({
        line: record.line,
        column: "status",
        code: "status_unknown",
        value: cell("status"),
      });
    }
    const priceMinor = aznToMinor(cell("price"));
    if (priceMinor === undefined) {
      rowIssues.push({
        line: record.line,
        column: "price",
        code: "price_format",
        value: cell("price"),
      });
    }
    if (block !== undefined && number !== undefined) {
      const key = `${block}\u0000${number}`;
      const first = seen.get(key);
      if (first !== undefined) {
        rowIssues.push({
          line: record.line,
          column: "number",
          code: "duplicate",
          value: `${block}-${number} (${first})`,
        });
      } else seen.set(key, record.line);
    }
    if (rowIssues.length) {
      issues.push(...rowIssues);
      continue;
    }
    rows.push({
      line: record.line,
      block: block!,
      floor: floor!,
      number: number!,
      layout: layout!,
      areaTotal: areaTotal!,
      status: status!,
      priceMinor: priceMinor!,
    });
  }
  return { total: body.length, rows, issues };
}

/** An apartment as an export writes it. */
export type InventoryCsvSource = {
  block: string;
  floor: number;
  number: string;
  layout: string;
  areaTotal: string;
  status: ApartmentStatus;
  priceMinor: string | null;
};

/**
 * A file the importer reads back unchanged: `;`-separated with decimal
 * commas, as Excel with Azerbaijani settings writes it, text cells guarded
 * against formulas.
 */
export function inventoryCsv(apartments: InventoryCsvSource[]): string {
  return writeCsv([
    csvColumns.map((column) => column.header),
    ...apartments.map((apartment) => [
      guardFormula(apartment.block),
      String(apartment.floor),
      guardFormula(apartment.number),
      guardFormula(apartment.layout),
      apartment.areaTotal.replace(".", ","),
      statusWord[apartment.status],
      minorToAzn(apartment.priceMinor),
    ]),
  ]);
}

/** The downloadable template: the header and one example row. */
export function inventoryTemplate(example: InventoryCsvSource): string {
  return inventoryCsv([example]);
}

export const importModes = ["upsert", "replaceDemo"] as const;

export type ImportMode = (typeof importModes)[number];

/** 1 MB of text is far more than the 143 apartments need. */
export const maxImportBytes = 1024 * 1024;

/**
 * `POST /api/v1/admin/apartments/import`. `upsert` updates apartments found
 * by block and number and adds the rest; `replaceDemo` also removes the demo
 * inventory. A dry run does everything, then rolls it back.
 */
export const importRequestSchema = z.strictObject({
  csv: z.string().min(1).max(maxImportBytes),
  mode: z.enum(importModes),
  dryRun: z.boolean(),
  /**
   * `replaceDemo` only: leads that point at a demo apartment lose the link
   * (the lead itself stays). Without it, such leads stop the import.
   */
  detachLeads: z.boolean().default(false),
});

export type ImportRequest = z.input<typeof importRequestSchema>;

export type ImportReport = {
  mode: ImportMode;
  dryRun: boolean;
  /** Whether the changes were written: never on a dry run or with issues. */
  applied: boolean;
  rows: number;
  issues: ImportIssue[];
  created: number;
  updated: number;
  unchanged: number;
  floorsCreated: number;
  /** `replaceDemo`: what of the demo inventory is removed, and what is kept as real. */
  demo: {
    apartments: number;
    floors: number;
    blocks: number;
    buildings: number;
    /** Demo floors, blocks and buildings the file uses, kept and no longer marked demo. */
    kept: number;
    /** Leads that point at a demo apartment. */
    leads: number;
  };
};
