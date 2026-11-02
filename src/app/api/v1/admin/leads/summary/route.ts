import { getDb } from "@/db";
import { leadSummary } from "@/lib/admin/leads";
import { handler } from "@/lib/api/handler";

/** How many new leads the user may work: the count on the sidebar. */
export const GET = handler({ auth: { leads: ["read"] } }, ({ user }) => leadSummary(getDb(), user));
