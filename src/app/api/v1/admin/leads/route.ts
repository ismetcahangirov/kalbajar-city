import { getDb } from "@/db";
import { listAdminLeads } from "@/lib/admin/leads";
import { handler } from "@/lib/api/handler";
import { adminLeadListQuerySchema } from "@/shared/leads";

/** The leads the user may work: all with `leads:assign`, else theirs and the unassigned. */
export const GET = handler(
  { auth: { leads: ["read"] }, query: adminLeadListQuerySchema },
  ({ query, user }) => listAdminLeads(getDb(), query, user),
);
