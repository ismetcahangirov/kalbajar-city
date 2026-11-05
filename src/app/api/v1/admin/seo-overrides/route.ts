import { getDb } from "@/db";
import { listSeoOverrides, saveSeoOverride } from "@/lib/admin/seo-overrides";
import { handler } from "@/lib/api/handler";
import { seoOverrideCreateSchema } from "@/shared/seo-overrides";

/** Every per-page override; they are few, so the list is not paginated. */
export const GET = handler({ auth: { seo: ["read"] } }, () => listSeoOverrides(getDb()));

/** One override per path; a second one for the same path is refused with 422. */
export const POST = handler(
  { auth: { seo: ["update"] }, body: seoOverrideCreateSchema, status: 201 },
  ({ body, user, request }) =>
    saveSeoOverride(getDb(), { input: body, user, headers: request.headers }),
);
