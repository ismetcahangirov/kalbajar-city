"use client";

import { SidebarMenuBadge } from "@/components/admin/ui/sidebar";
import { t } from "@/lib/admin/messages";
import { useAdminLeadSummaryQuery } from "@/store/endpoints/admin-leads";

export const newLeadsBadgeId = "new-leads-count";

/**
 * The number of new leads the user may work, beside the menu item, refreshed
 * like the list. The menu link names it through `aria-describedby`.
 */
export function NewLeadsBadge() {
  const { data } = useAdminLeadSummaryQuery(undefined, {
    pollingInterval: 15_000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });
  const count = data?.new ?? 0;
  if (count === 0) return null;
  return (
    <SidebarMenuBadge id={newLeadsBadgeId} data-testid="new-leads-badge">
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t("leads.newCount", { count })}</span>
    </SidebarMenuBadge>
  );
}
