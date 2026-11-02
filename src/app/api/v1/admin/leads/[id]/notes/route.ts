import { getDb } from "@/db";
import { addLeadNote } from "@/lib/admin/leads";
import { handler } from "@/lib/api/handler";
import { leadIdParamsSchema, leadNoteSchema } from "@/shared/leads";

export const POST = handler(
  {
    auth: { leads: ["update"] },
    params: leadIdParamsSchema,
    body: leadNoteSchema,
    status: 201,
  },
  ({ params, body, user, request }) =>
    addLeadNote(getDb(), { id: params.id, body: body.body, user, headers: request.headers }),
);
