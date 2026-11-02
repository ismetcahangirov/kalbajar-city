import { getDb } from "@/db";
import { updateLeadSettings } from "@/lib/admin/leads";
import { handler } from "@/lib/api/handler";
import { leadSettings } from "@/lib/leads/settings";
import { settingsSchemas } from "@/shared/settings";

/** Who gets the new-lead e-mail and how long leads are kept. */
export const GET = handler({ auth: { settings: ["read"] } }, () => leadSettings(getDb()));

export const PUT = handler(
  { auth: { settings: ["update"] }, body: settingsSchemas.leads },
  ({ body, user, request }) =>
    updateLeadSettings(getDb(), { input: body, user, headers: request.headers }),
);
