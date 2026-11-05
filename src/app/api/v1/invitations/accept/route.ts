import { getDb } from "@/db";
import { acceptInvitation } from "@/lib/admin/invitations";
import { handler } from "@/lib/api/handler";
import { invitationAcceptSchema } from "@/shared/users";

/**
 * Public: the e-mailed token is the credential, so this is outside
 * `/api/v1/admin`. Refused with 410 `INVITATION_INVALID`, without saying why.
 */
export const POST = handler(
  { body: invitationAcceptSchema, status: 201 },
  async ({ body, request }) => {
    await acceptInvitation(getDb(), body, request.headers);
    return { accepted: true };
  },
);
