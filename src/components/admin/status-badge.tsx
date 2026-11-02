import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import type { ApartmentStatus } from "@/shared/inventory";

const tones: Record<ApartmentStatus, string> = {
  available: "text-status-available",
  reserved: "text-status-reserved",
  sold: "text-status-sold",
  not_for_sale: "text-text-muted",
};

/** An apartment's status: a dot and the word, so colour never carries it alone. */
export function StatusBadge({ status }: { status: ApartmentStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium", tones[status])}>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />
      {t(`status.${status}`)}
    </span>
  );
}
