import { getDb } from "@/db";
import { resendInvitation } from "@/lib/admin/invitations";
import { handler } from "@/lib/api/handler";
import { invitationIdParamsSchema } from "@/shared/users";

export const POST = handler(
  { auth: { user: ["create"] }, params: invitationIdParamsSchema },
  ({ params, user, request }) =>
    resendInvitation(getDb(), { id: params.id, user, headers: request.headers }),
);
