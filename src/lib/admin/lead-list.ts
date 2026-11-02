import type { AdminLeadListParams, LeadStatus, LeadType } from "@/shared/leads";

import type { TableState } from "./table-state";

/** Where the list's filters live in the URL; keys are Azerbaijani like the routes. */
export const leadFilterKeys = {
  status: "status",
  type: "nov",
  source: "menbe",
  apartment: "menzil",
  assignee: "mesul",
  from: "tarixden",
  to: "tarixedek",
} as const;

export const leadsHref = "/admin/muracietler";

/** The URL state as the list endpoint's parameters. */
export function leadListParams({
  page,
  pageSize,
  sort,
  filters,
}: TableState & { pageSize: number }): AdminLeadListParams {
  const from = filters[leadFilterKeys.from]?.[0];
  let to = filters[leadFilterKeys.to]?.[0];
  // A range the wrong way round would be refused; the end is dropped instead.
  if (from && to && to < from) to = undefined;
  return {
    page,
    pageSize,
    sort: sort as AdminLeadListParams["sort"],
    status: filters[leadFilterKeys.status] as LeadStatus[] | undefined,
    type: filters[leadFilterKeys.type] as LeadType[] | undefined,
    source: filters[leadFilterKeys.source],
    apartment: filters[leadFilterKeys.apartment],
    assignee: filters[leadFilterKeys.assignee],
    from,
    to,
  };
}
