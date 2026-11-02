import { getDb } from "@/db";
import { exportLeadRows } from "@/lib/admin/leads";
import { leadsCsv } from "@/lib/admin/leads-export";
import { handler } from "@/lib/api/handler";
import { audit } from "@/lib/audit";
import { adminLeadListQuerySchema } from "@/shared/leads";

/**
 * Every lead the list's filters match, as CSV for Excel (owner and admin:
 * `leads:export`). Pagination is ignored. The export is audited: it takes
 * personal data out of the console.
 */
export const GET = handler(
  { auth: { leads: ["export"] }, query: adminLeadListQuerySchema },
  async ({ query, user, request }) => {
    const db = getDb();
    const rows = await exportLeadRows(db, query, user);
    const { status, type, source, apartment, assignee, from, to } = query;
    await audit(db, {
      actorId: user.id,
      action: "lead.export",
      entityType: "lead",
      after: {
        count: rows.length,
        filters: { status, type, source, apartment, assignee, from, to },
      },
      headers: request.headers,
    });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(leadsCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="muracietler-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
