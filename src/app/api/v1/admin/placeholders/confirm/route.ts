import { getDb } from "@/db";
import { confirmPlaceholders } from "@/lib/admin/placeholders";
import { handler } from "@/lib/api/handler";
import { placeholderConfirmSchema } from "@/shared/placeholders";

/**
 * Accepts stand-ins as real values without changing them. Each path also needs
 * the permission its value's save needs (`settings:update`, or
 * `content:update` for the location section).
 */
export const POST = handler(
  { auth: { settings: ["read"] }, body: placeholderConfirmSchema },
  async ({ body, user, request }) => ({
    paths: await confirmPlaceholders(getDb(), {
      paths: body.paths,
      user,
      headers: request.headers,
    }),
  }),
);
