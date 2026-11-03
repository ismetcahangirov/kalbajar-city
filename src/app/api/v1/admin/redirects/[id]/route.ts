import { getDb } from "@/db";
import { deleteRedirect, saveRedirect } from "@/lib/admin/redirects";
import { handler } from "@/lib/api/handler";
import { redirectIdParamsSchema, redirectUpdateSchema } from "@/shared/redirects";

/** Replaces the redirect; the same loop and chain checks as creating one apply. */
export const PUT = handler(
  { auth: { seo: ["update"] }, params: redirectIdParamsSchema, body: redirectUpdateSchema },
  ({ params, body, user, request }) =>
    saveRedirect(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

export const DELETE = handler(
  { auth: { seo: ["update"] }, params: redirectIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteRedirect(getDb(), { id: params.id, user, headers: request.headers });
  },
);
