import { getDb } from "@/db";
import { listSeoPages } from "@/lib/admin/seo-overrides";
import { handler } from "@/lib/api/handler";

/** The pages the console suggests for an override: the routes, apartments and articles. */
export const GET = handler({ auth: { seo: ["read"] } }, () => listSeoPages(getDb()));
