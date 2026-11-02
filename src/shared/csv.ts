/**
 * A small CSV reader and writer (RFC 4180): fields in double quotes may hold
 * the separator, line breaks and doubled quotes. Files arrive as UTF-8 with
 * or without a byte order mark, separated by `,` or by `;`, which Excel uses
 * where the decimal separator is a comma (Azerbaijani settings among them).
 */

export type CsvSeparator = "," | ";";

/** One record and the line of the file it starts on (1-based), for error messages. */
export type CsvRecord = { line: number; fields: string[] };

const bom = "﻿";

/**
 * The separator of a file: whichever of `;` and `,` occurs more often in its
 * first line outside quotes. A header row has no decimals, so this is safe.
 */
export function detectSeparator(text: string): CsvSeparator {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of text.startsWith(bom) ? text.slice(1) : text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char === ",") commas++;
    else if (!quoted && char === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

export class CsvError extends Error {
  constructor(
    readonly line: number,
    message: string,
  ) {
    super(message);
    this.name = "CsvError";
  }
}

/**
 * The records of a file. Blank lines are skipped; a quote left open, or text
 * right after a closing quote, throws a `CsvError` with its line.
 */
export function parseCsv(input: string, separator = detectSeparator(input)): CsvRecord[] {
  const text = input.startsWith(bom) ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let line = 1;
  let start = 1;
  let quoted = false;
  /** The current field was quoted and its closing quote has been read. */
  let closed = false;

  const endRecord = () => {
    fields.push(field);
    // A record that is one empty field is a blank line.
    if (fields.length > 1 || fields[0] !== "") records.push({ line: start, fields });
    fields = [];
    field = "";
    closed = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        if (char === "\n") line++;
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "" && !closed) {
      quoted = true;
    } else if (char === separator) {
      fields.push(field);
      field = "";
      closed = false;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      start = line;
    } else if (closed) {
      throw new CsvError(line, "Text after a closing quote");
    } else {
      field += char;
    }
  }
  if (quoted) throw new CsvError(start, "A quoted field is never closed");
  if (field !== "" || fields.length || closed) endRecord();
  return records;
}

/** A field as written: quoted when it holds the separator, a quote or a line break. */
function writeField(value: string, separator: CsvSeparator): string {
  return value.includes(separator) || /["\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/**
 * A file Excel opens with its letters intact: a byte order mark, CRLF line
 * endings, fields quoted where needed.
 */
export function writeCsv(rows: string[][], separator: CsvSeparator = ";"): string {
  return (
    bom +
    rows
      .map((row) => row.map((value) => writeField(value, separator)).join(separator))
      .join("\r\n") +
    "\r\n"
  );
}

/**
 * Keeps a text cell from being read as a formula by a spreadsheet (CSV
 * injection): a value starting with `=`, `+`, `-` or `@` gets a leading `'`.
 * Only for text columns; numbers keep their sign.
 */
export function guardFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/** Undoes `guardFormula` when a file the console exported comes back. */
export function unguardFormula(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}
