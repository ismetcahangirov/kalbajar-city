import { getDb } from "@/db";
import { inviteUser, listInvitations } from "@/lib/admin/invitations";
import { handler } from "@/lib/api/handler";
import { invitationCreateSchema } from "@/shared/users";

export const GET = handler({ auth: { user: ["list"] } }, ({ user }) =>
  listInvitations(getDb(), user),
);

/** `mailSent: false` means the invitation stands but its e-mail failed; send it again. */
export const POST = handler(
  { auth: { user: ["create"] }, body: invitationCreateSchema, status: 201 },
  ({ body, user, request }) =>
    inviteUser(getDb(), { email: body.email, role: body.role, user, headers: request.headers }),
);
