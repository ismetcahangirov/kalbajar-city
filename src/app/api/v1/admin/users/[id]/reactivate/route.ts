import { getDb } from "@/db";
import { reactivateUser } from "@/lib/admin/users";
import { handler } from "@/lib/api/handler";
import { userIdParamsSchema } from "@/shared/users";

export const POST = handler(
  { auth: { user: ["ban"] }, params: userIdParamsSchema },
  ({ params, user, request }) =>
    reactivateUser(getDb(), { id: params.id, user, headers: request.headers }),
);
