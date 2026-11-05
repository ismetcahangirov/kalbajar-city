import { getDb } from "@/db";
import { deactivateUser } from "@/lib/admin/users";
import { handler } from "@/lib/api/handler";
import { userIdParamsSchema } from "@/shared/users";

/** Ends the account's sessions too. Refused with 409 `LAST_OWNER` for the last active owner. */
export const POST = handler(
  { auth: { user: ["ban"] }, params: userIdParamsSchema },
  ({ params, user, request }) =>
    deactivateUser(getDb(), { id: params.id, user, headers: request.headers }),
);
