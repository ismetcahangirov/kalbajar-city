import { getDb } from "@/db";
import { deleteSeoOverride, saveSeoOverride } from "@/lib/admin/seo-overrides";
import { handler } from "@/lib/api/handler";
import { seoOverrideCreateSchema, seoOverrideIdParamsSchema } from "@/shared/seo-overrides";

/** Replaces the override; the page shows it on the next request. */
export const PUT = handler(
  { auth: { seo: ["update"] }, params: seoOverrideIdParamsSchema, body: seoOverrideCreateSchema },
  ({ params, body, user, request }) =>
    saveSeoOverride(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

export const DELETE = handler(
  { auth: { seo: ["update"] }, params: seoOverrideIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteSeoOverride(getDb(), { id: params.id, user, headers: request.headers });
  },
);
