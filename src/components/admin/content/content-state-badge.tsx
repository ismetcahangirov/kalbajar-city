import { CalendarClock, Eye, EyeOff } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { t } from "@/lib/admin/messages";
import type { ContentState } from "@/shared/content";

const icons = { draft: EyeOff, scheduled: CalendarClock, published: Eye } as const;

/** An entry's state in words with an icon, never colour alone. */
export function ContentStateBadge({ state }: { state: ContentState }) {
  const Icon = icons[state];
  return (
    <Badge variant={state === "published" ? "default" : "secondary"}>
      <Icon aria-hidden />
      {t(`contentState.${state}`)}
    </Badge>
  );
}
