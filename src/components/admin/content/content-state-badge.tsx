import { CalendarClock, ClockAlert, Eye, EyeOff } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { t } from "@/lib/admin/messages";
import type { ContentState } from "@/shared/content";

const icons = { draft: EyeOff, scheduled: CalendarClock, published: Eye } as const;

/**
 * An entry's state in words with an icon, never colour alone. A scheduled
 * entry whose time has passed says so (`scheduleOverdue`): it has not gone
 * out, and an editor should know.
 */
export function ContentStateBadge({
  state,
  overdue = false,
}: {
  state: ContentState;
  overdue?: boolean;
}) {
  if (state === "scheduled" && overdue) {
    return (
      <Badge variant="destructive">
        <ClockAlert aria-hidden />
        {t("contentState.overdue")}
      </Badge>
    );
  }
  const Icon = icons[state];
  return (
    <Badge variant={state === "published" ? "default" : "secondary"}>
      <Icon aria-hidden />
      {t(`contentState.${state}`)}
    </Badge>
  );
}
