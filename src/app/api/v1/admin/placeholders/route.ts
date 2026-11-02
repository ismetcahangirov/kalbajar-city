import { getDb } from "@/db";
import { getPlaceholders } from "@/lib/admin/placeholders";
import { handler } from "@/lib/api/handler";

/** The values still flagged as stand-ins waiting for the owner (#27). */
export const GET = handler({ auth: { settings: ["read"] } }, async () => ({
  paths: await getPlaceholders(getDb()),
}));
