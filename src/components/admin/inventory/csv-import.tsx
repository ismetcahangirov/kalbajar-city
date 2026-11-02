"use client";

import { Download, FileCheck, Upload } from "lucide-react";
import { useId, useState } from "react";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { FormAlert } from "@/components/admin/form-alert";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { t } from "@/lib/admin/messages";
import {
  csvColumns,
  importModes,
  type ImportIssue,
  type ImportMode,
  type ImportReport,
} from "@/shared/inventory-csv";
import { importReportOf, useImportApartmentsMutation } from "@/store/endpoints/admin-inventory";

/** The file as text, refusing anything that is not UTF-8 (Excel's plain "CSV" is not). */
async function readUtf8(file: File): Promise<string | null> {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return null;
  }
}

function issueText(issue: ImportIssue): string {
  return t(`import.issue.${issue.code}`, { value: issue.value ?? "" });
}

const columnName = (column: ImportIssue["column"]) =>
  column ? (csvColumns.find((candidate) => candidate.key === column)?.header ?? column) : "–";

/**
 * The CSV import: a template to fill, a dry run that reports every invalid
 * row by its line, then the real run, which writes everything in one
 * transaction or nothing. The real run is offered only after a clean dry run
 * of the same file and mode.
 */
export function CsvImport() {
  const id = useId();
  const confirm = useConfirm();
  const [run, { isLoading }] = useImportApartmentsMutation();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [detachLeads, setDetachLeads] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const reset = () => {
    setReport(null);
    setDetachLeads(false);
  };

  const submit = async (dryRun: boolean) => {
    if (!file) {
      setFileError(t("import.noFile"));
      return;
    }
    if (!dryRun) {
      const confirmed = await confirm({
        title: t("import.confirmTitle"),
        description: t("import.confirmLead", {
          created: report?.created ?? 0,
          updated: report?.updated ?? 0,
        }),
        confirmLabel: t("import.run"),
      });
      if (!confirmed) return;
    }
    try {
      const result = await run({ csv: file.text, mode, dryRun, detachLeads }).unwrap();
      setReport(result);
      if (result.applied) {
        toast.success(t("import.done", { created: result.created, updated: result.updated }));
      }
    } catch (error) {
      const refused = importReportOf(error);
      if (refused) setReport(refused);
      else toastApiError(error);
    }
  };

  const ready =
    report?.dryRun &&
    report.issues.length === 0 &&
    (report.mode !== "replaceDemo" || report.demo.leads === 0 || detachLeads);

  return (
    <div className="flex max-w-4xl min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-md border p-4">
        <p className="text-sm">{t("import.templateHint")}</p>
        <div>
          <Button asChild variant="outline">
            <a href="/api/v1/admin/apartments/template.csv" download>
              <Download aria-hidden />
              {t("import.template")}
            </a>
          </Button>
        </div>
      </section>

      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-file`}>{t("import.file")}</Label>
          <Input
            id={`${id}-file`}
            type="file"
            accept=".csv,text/csv"
            aria-invalid={Boolean(fileError)}
            aria-describedby={`${id}-file-hint${fileError ? ` ${id}-file-error` : ""}`}
            onChange={async (event) => {
              reset();
              const chosen = event.target.files?.[0];
              if (!chosen) {
                setFile(null);
                return;
              }
              const text = await readUtf8(chosen);
              setFileError(text === null ? t("import.notUtf8") : null);
              setFile(text === null ? null : { name: chosen.name, text });
            }}
          />
          <p id={`${id}-file-hint`} className="text-sm text-muted-foreground">
            {t("import.fileHint")}
          </p>
          <p id={`${id}-file-error`} role="alert" className="text-sm text-destructive empty:hidden">
            {fileError}
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm mb-2 font-medium">{t("import.mode")}</legend>
          {importModes.map((value) => (
            <label key={value} className="flex min-h-target items-start gap-3 py-1">
              <input
                type="radio"
                name={`${id}-mode`}
                value={value}
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  reset();
                }}
                aria-describedby={`${id}-${value}-hint`}
                className="accent-primary mt-0.5 size-5 shrink-0"
              />
              <span className="flex flex-col gap-0.5">
                <span>{t(`import.mode.${value}`)}</span>
                <span id={`${id}-${value}-hint`} className="text-sm text-muted-foreground">
                  {t(`import.mode.${value}Hint`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline" disabled={isLoading}>
            <FileCheck aria-hidden />
            {isLoading ? t("import.checking") : t("import.check")}
          </Button>
          <Button
            type="button"
            disabled={!ready || isLoading}
            aria-describedby={`${id}-run-hint`}
            onClick={() => void submit(false)}
          >
            <Upload aria-hidden />
            {isLoading ? t("import.running") : t("import.run")}
          </Button>
        </div>
        <p id={`${id}-run-hint`} className="text-sm text-muted-foreground">
          {t("import.runHint")}
        </p>
      </form>

      <div aria-live="polite">
        {report ? (
          <Report report={report} detachLeads={detachLeads} onDetachLeads={setDetachLeads} />
        ) : null}
      </div>
    </div>
  );
}

function Report({
  report,
  detachLeads,
  onDetachLeads,
}: {
  report: ImportReport;
  detachLeads: boolean;
  onDetachLeads: (value: boolean) => void;
}) {
  const id = useId();
  const title = report.issues.length
    ? t("import.reportInvalid", { count: report.issues.length })
    : report.applied
      ? t("import.reportDone")
      : t("import.reportDry");
  const facts: Array<[string, string | number]> = [
    [t("import.rows"), report.rows],
    [t("import.created"), report.created],
    [t("import.updated"), report.updated],
    [t("import.unchanged"), report.unchanged],
    [t("import.floorsCreated"), report.floorsCreated],
  ];
  if (report.mode === "replaceDemo") {
    facts.push(
      [t("import.demoApartments"), report.demo.apartments],
      [
        t("import.demoStructure"),
        `${report.demo.floors}, ${report.demo.blocks}, ${report.demo.buildings}`,
      ],
      [t("import.demoKept"), report.demo.kept],
    );
  }

  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-md border p-4">
      <h2 id={id} className="text-lg font-medium">
        {title}
      </h2>
      {report.issues.length ? (
        <FormAlert message={t("error.importInvalid")} />
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {!report.issues.length && report.mode === "replaceDemo" && report.demo.leads > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <p>{t("import.leads", { count: report.demo.leads })}</p>
          <label className="flex min-h-target items-center gap-3">
            <Checkbox
              checked={detachLeads}
              onCheckedChange={(value) => onDetachLeads(value === true)}
              className="size-5"
            />
            {t("import.detachLeads")}
          </label>
        </div>
      ) : null}

      {report.issues.length ? (
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="font-medium">{t("import.issues")}</h3>
          <div className="max-h-[32rem] overflow-auto rounded-md border">
            <Table>
              <TableCaption className="sr-only">{t("import.issuesCaption")}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="text-right">
                    {t("import.issueLine")}
                  </TableHead>
                  <TableHead scope="col">{t("import.issueColumn")}</TableHead>
                  <TableHead scope="col">{t("import.issueProblem")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.issues.map((issue, index) => (
                  <TableRow key={index} data-line={issue.line}>
                    <TableHead scope="row" className="text-foreground text-right font-medium">
                      {issue.line}
                    </TableHead>
                    <TableCell>{columnName(issue.column)}</TableCell>
                    <TableCell className="whitespace-normal">{issueText(issue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
