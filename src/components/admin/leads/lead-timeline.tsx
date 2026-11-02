import {
  ArrowRightLeft,
  Inbox,
  Mail,
  MailWarning,
  ShieldOff,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { adminDateTime } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import {
  leadStatuses,
  leadTypes,
  type LeadEventType,
  type LeadStatus,
  type LeadTimelineEntry,
  type LeadType,
} from "@/shared/leads";

const icons: Record<LeadEventType, LucideIcon> = {
  created: Inbox,
  status_changed: ArrowRightLeft,
  assigned: UserRound,
  note_added: StickyNote,
  notified: Mail,
  anonymised: ShieldOff,
};

const isStatus = (value: unknown): value is LeadStatus =>
  typeof value === "string" && (leadStatuses as readonly string[]).includes(value);

const isType = (value: unknown): value is LeadType =>
  typeof value === "string" && (leadTypes as readonly string[]).includes(value);

const text = (value: unknown) => (typeof value === "string" ? value : null);

/** What happened, in a sentence. */
function describe(entry: LeadTimelineEntry): string {
  const data = entry.data ?? {};
  switch (entry.type) {
    case "created":
      return isType(data.type)
        ? t("leads.event.createdAs", { type: t(`leadType.${data.type}`) })
        : t("leads.event.created");
    case "status_changed": {
      const from = isStatus(data.from) ? t(`leadStatus.${data.from}`) : "?";
      const to = isStatus(data.to) ? t(`leadStatus.${data.to}`) : "?";
      return t("leads.event.status", { from, to });
    }
    case "assigned": {
      const to = text(data.toName);
      return to ? t("leads.event.assigned", { name: to }) : t("leads.event.unassigned");
    }
    case "note_added":
      return t("leads.event.note");
    case "notified":
      return data.ok === true ? t("leads.event.notified") : t("leads.event.notifyFailed");
    case "anonymised":
      return t("leads.event.anonymised");
  }
}

/** The lead's history, newest first: who did what, and when. */
export function LeadTimeline({ entries }: { entries: LeadTimelineEntry[] }) {
  if (!entries.length) return <p className="text-sm">{t("leads.timelineEmpty")}</p>;
  return (
    <ol className="flex flex-col" data-testid="lead-timeline">
      {entries.map((entry) => {
        const Icon =
          entry.type === "notified" && entry.data?.ok !== true ? MailWarning : icons[entry.type];
        const reason = entry.type === "status_changed" ? text(entry.data?.reason) : null;
        return (
          <li key={entry.id} className="flex gap-3 border-b py-3 last:border-b-0">
            <Icon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm">
                <span className="font-medium">{describe(entry)}</span>
                {reason ? <span>: {reason}</span> : null}
              </p>
              {entry.note !== undefined ? (
                <p className="text-sm break-words whitespace-pre-wrap">
                  {entry.note || (
                    <span className="text-muted-foreground">{t("leads.noteCleared")}</span>
                  )}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {entry.actor?.name ??
                  t(entry.type === "created" ? "leads.event.site" : "leads.event.system")}{" "}
                · <time dateTime={entry.at}>{adminDateTime(entry.at)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
