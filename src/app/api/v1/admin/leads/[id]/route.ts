import { getDb } from "@/db";
import { getAdminLead, updateLead } from "@/lib/admin/leads";
import { handler } from "@/lib/api/handler";
import { leadIdParamsSchema, leadUpdateSchema } from "@/shared/leads";

/** The lead with its apartment, timeline and notes. */
export const GET = handler(
  { auth: { leads: ["read"] }, params: leadIdParamsSchema },
  ({ params, user }) => getAdminLead(getDb(), params.id, user),
);

/** The pipeline status (`lost` with a reason) and the assignee. Answers the updated lead. */
export const PATCH = handler(
  { auth: { leads: ["update"] }, params: leadIdParamsSchema, body: leadUpdateSchema },
  async ({ params, body, user, request }) => {
    const db = getDb();
    await updateLead(db, { id: params.id, input: body, user, headers: request.headers });
    return getAdminLead(db, params.id, user);
  },
);
