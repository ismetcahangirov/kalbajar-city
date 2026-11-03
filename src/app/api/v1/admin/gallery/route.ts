import { getDb } from "@/db";
import { getAdminGallery } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";

/** The whole gallery, drafts included: categories and their items, in display order. */
export const GET = handler({ auth: { content: ["read"] } }, () => getAdminGallery(getDb()));
