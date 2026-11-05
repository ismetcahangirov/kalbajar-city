import { getDb } from "@/db";
import { setUserRole } from "@/lib/admin/users";
import { handler } from "@/lib/api/handler";
import { setRoleSchema, userIdParamsSchema } from "@/shared/users";

/** Refused with 409 `LAST_OWNER` when it would leave no active owner. */
export const PUT = handler(
  { auth: { user: ["set-role"] }, params: userIdParamsSchema, body: setRoleSchema },
  ({ params, body, user, request }) =>
    setUserRole(getDb(), { id: params.id, role: body.role, user, headers: request.headers }),
);
