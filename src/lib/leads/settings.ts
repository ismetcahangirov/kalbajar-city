import { eq } from "drizzle-orm";

import type { Executor } from "@/db/client";
import { settings } from "@/db/schema";
import { defaultLeadSettings, settingsSchemas, type SettingsValue } from "@/shared/settings";

// Not server-only: the retention script (scripts/leads-retention.mts) reads it too.

export type LeadSettings = SettingsValue<"leads">;

/** The leads settings, or the defaults while the row is missing or invalid. */
export async function leadSettings(db: Executor): Promise<LeadSettings> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "leads"));
  return settingsSchemas.leads.safeParse(row?.value).data ?? defaultLeadSettings;
}
