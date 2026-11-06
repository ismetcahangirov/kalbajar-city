"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog";
import { auditActionLabel, auditEntityLabel, auditValueText } from "@/lib/admin/audit-labels";
import { adminDateTime } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import { auditChanges, auditRedacted, type AdminAuditEntry } from "@/shared/audit";

const quiet = "text-muted-foreground italic";

/** One side of a changed field; absent, empty and hidden each say so in words. */
function Side({ label, present, value }: { label: string; present: boolean; value: unknown }) {
  return (
    <div className="bg-muted min-w-0 rounded-md p-3">
      <p className="text-muted-foreground text-xs mb-1 font-medium">{label}</p>
      {!present ? (
        <p className={`text-sm ${quiet}`}>{t("audit.log.absent")}</p>
      ) : value === null ? (
        <p className={`text-sm ${quiet}`}>{t("audit.log.null")}</p>
      ) : value === auditRedacted ? (
        <p className={`text-sm ${quiet}`}>{t("audit.log.redacted")}</p>
      ) : (
        <pre className="font-mono text-sm wrap-anywhere whitespace-pre-wrap">
          {auditValueText(value)}
        </pre>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm wrap-anywhere">{children}</dd>
    </div>
  );
}

/**
 * The entry whole: each stored field first, then who, what and from where.
 * Only the sides the entry has appear, so a created entity is not shown as
 * empty before.
 */
export function AuditDetails({ entry }: { entry: AdminAuditEntry }) {
  const changes = auditChanges(entry);
  const title = auditActionLabel(entry.action);
  const when = adminDateTime(entry.createdAt);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-target md:min-h-0">
          {t("audit.log.open")}
          <span className="sr-only">
            {": "}
            {title}, {when}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            <time dateTime={entry.createdAt}>{when}</time>
          </DialogDescription>
        </DialogHeader>

        <h3 className="text-sm font-semibold">{t("audit.log.changes")}</h3>
        {changes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("audit.log.noDiff")}</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-4">
            {changes.map((change) => (
              <li key={change.field} className="min-w-0">
                <p className="font-mono text-sm mb-2 font-medium wrap-anywhere">{change.field}</p>
                <div className={entry.before && entry.after ? "grid gap-2 sm:grid-cols-2" : "grid"}>
                  {entry.before ? (
                    <Side
                      label={t("audit.log.before")}
                      present={Object.hasOwn(change, "before")}
                      value={change.before}
                    />
                  ) : null}
                  {entry.after ? (
                    <Side
                      label={t("audit.log.after")}
                      present={Object.hasOwn(change, "after")}
                      value={change.after}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <dl className="grid gap-3 sm:grid-cols-2">
          <Fact label={t("audit.log.actor")}>{entry.actor?.name ?? t("audit.log.system")}</Fact>
          <Fact label={t("audit.log.entity")}>{auditEntityLabel(entry.entityType)}</Fact>
          {entry.entityId ? (
            <Fact label={t("audit.log.entityId")}>
              <span className="font-mono">{entry.entityId}</span>
            </Fact>
          ) : null}
          {entry.ip ? <Fact label={t("audit.log.ip")}>{entry.ip}</Fact> : null}
          {entry.userAgent ? <Fact label={t("audit.log.userAgent")}>{entry.userAgent}</Fact> : null}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
