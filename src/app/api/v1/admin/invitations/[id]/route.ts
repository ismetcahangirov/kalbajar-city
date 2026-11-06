import { getDb } from "@/db";
import { revokeInvitation } from "@/lib/admin/invitations";
import { handler } from "@/lib/api/handler";
import { invitationIdParamsSchema } from "@/shared/users";

export const DELETE = handler(
  { auth: { user: ["create"] }, params: invitationIdParamsSchema },
  async ({ params, user, request }) => {
    await revokeInvitation(getDb(), { id: params.id, user, headers: request.headers });
  },
);
