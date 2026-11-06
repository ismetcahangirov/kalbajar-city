import { getDb } from "@/db";
import { listHomeSections } from "@/lib/admin/home-sections";
import { handler } from "@/lib/api/handler";

/** Every home section in the site's order, hidden ones included (#17). */
export const GET = handler({ auth: { content: ["read"] } }, () => listHomeSections(getDb()));
