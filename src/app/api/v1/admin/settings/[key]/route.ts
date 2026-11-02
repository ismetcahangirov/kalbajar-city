import { z } from "zod";

import { getDb } from "@/db";
import { getSetting, updateSetting } from "@/lib/admin/settings";
import { handler } from "@/lib/api/handler";
import { settingsKeyParamsSchema } from "@/shared/settings";

export const GET = handler(
  { auth: { settings: ["read"] }, params: settingsKeyParamsSchema },
  ({ params }) => getSetting(getDb(), params.key),
);

/** Replaces the key's whole value; it is validated against that key's schema. */
export const PUT = handler(
  { auth: { settings: ["update"] }, params: settingsKeyParamsSchema, body: z.unknown() },
  ({ params, body, user, request }) =>
    updateSetting(getDb(), { key: params.key, value: body, user, headers: request.headers }),
);
