import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import type { LeadStatus } from "@/shared/leads";

const tones: Record<LeadStatus, string> = {
  new: "text-text-accent",
  contacted: "text-foreground",
  viewing: "text-status-reserved",
  reserved: "text-status-reserved",
  closed: "text-status-available",
  lost: "text-muted-foreground",
};

/** A lead's pipeline status: a dot and the word, so colour never carries it alone. */
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      data-lead-status={status}
      className={cn("inline-flex items-center gap-1.5 font-medium", tones[status])}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />
      {t(`leadStatus.${status}`)}
    </span>
  );
}

/** The word "Yeni" beside a lead nobody has worked yet; the row's tint only repeats it. */
export function NewLeadMarker() {
  return (
    <span className="text-xs inline-flex shrink-0 items-center rounded-full border border-text-accent px-2 py-0.5 font-medium text-text-accent">
      {t("leadStatus.new")}
    </span>
  );
}
