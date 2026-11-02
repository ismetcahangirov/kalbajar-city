/**
 * The leads CSV (#26), built to open by double-click in Excel:
 *
 * - UTF-8 with a byte order mark, without which Excel reads Azerbaijani
 *   letters (ə, ğ, ş) as the system code page
 * - `;` between values: the list separator of the Azerbaijani and Russian
 *   regional formats the sales team's machines use. Excel splits a CSV it
 *   opens by double-click on that separator, not on RFC 4180's comma
 * - every value quoted, quotes doubled, CRLF between rows
 * - a value starting with `=`, `+`, `-`, `@`, a tab or a carriage return is
 *   prefixed with `'`, so a spreadsheet never runs it as a formula (CSV
 *   injection). Phones in E.164 start with `+` and get the prefix too
 */

export const csvDelimiter = ";";

const bom = "﻿";

const formulaStart = /^[=+\-@\t\r]/;

/** One value, guarded against formulas and quoted. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = formulaStart.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** A whole file: the header row first. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>) {
  return bom + rows.map((row) => row.map(csvCell).join(csvDelimiter)).join("\r\n") + "\r\n";
}
