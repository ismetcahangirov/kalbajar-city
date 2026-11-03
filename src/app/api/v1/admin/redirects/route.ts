import { getDb } from "@/db";
import { listRedirects, saveRedirect } from "@/lib/admin/redirects";
import { handler } from "@/lib/api/handler";
import { redirectCreateSchema } from "@/shared/redirects";

/** Every redirect with its hit counter; they are few, so the list is not paginated. */
export const GET = handler({ auth: { seo: ["read"] } }, () => listRedirects(getDb()));

/** Refused with 422 `REDIRECT_LOOP`, or 409 `REDIRECT_CHAIN` unless `resolveChains` is set. */
export const POST = handler(
  { auth: { seo: ["update"] }, body: redirectCreateSchema, status: 201 },
  ({ body, user, request }) =>
    saveRedirect(getDb(), { input: body, user, headers: request.headers }),
);
