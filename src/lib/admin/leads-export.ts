import "server-only";

import { formatPhone } from "@/i18n/format";
import { toCsv } from "@/lib/leads/csv";
import { utmKeys } from "@/shared/leads";

import { adminDateTime } from "./format";
import type { LeadExportRow } from "./leads";
import { t } from "./messages";

const date = (value: Date | null) => (value ? adminDateTime(value) : "");

/** The CSV export's columns: a header in Azerbaijani and the cell of a lead. */
const columns: Array<[header: string, cell: (row: LeadExportRow) => string]> = [
  [t("leads.csv.createdAt"), (row) => date(row.createdAt)],
  [t("leads.type"), (row) => t(`leadType.${row.type}`)],
  [t("leads.status"), (row) => t(`leadStatus.${row.status}`)],
  [t("leads.name"), (row) => row.name],
  [t("leads.phone"), (row) => (row.phone ? formatPhone(row.phone) : "")],
  [t("leads.email"), (row) => row.email ?? ""],
  [
    t("leads.apartment"),
    (row) =>
      row.apartmentNumber
        ? row.block
          ? `${row.block}-${row.apartmentNumber}`
          : row.apartmentNumber
        : "",
  ],
  [t("leads.preferredAt"), (row) => date(row.preferredAt)],
  [t("leads.message"), (row) => row.message ?? ""],
  [t("leads.source"), (row) => row.source],
  [t("leads.sourcePath"), (row) => row.sourcePath],
  ...utmKeys.map((key): [string, (row: LeadExportRow) => string] => [
    `utm_${key}`,
    (row) => row.utm?.[key] ?? "",
  ]),
  [t("leads.referrer"), (row) => row.referrer ?? ""],
  [t("leads.locale"), (row) => row.locale],
  [t("leads.assignee"), (row) => row.assigneeName ?? ""],
  [t("leads.lostReason"), (row) => row.lostReason ?? ""],
  [t("leads.csv.updatedAt"), (row) => date(row.updatedAt)],
  [t("leads.csv.anonymisedAt"), (row) => date(row.anonymisedAt)],
  [t("leads.csv.id"), (row) => row.id],
];

/** The leads as the CSV file the owner opens in Excel (`@/lib/leads/csv`). */
export function leadsCsv(rows: LeadExportRow[]): string {
  return toCsv([
    columns.map(([header]) => header),
    ...rows.map((row) => columns.map(([, cell]) => cell(row))),
  ]);
}
