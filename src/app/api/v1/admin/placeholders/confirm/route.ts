import { getDb } from "@/db";
import { confirmPlaceholders } from "@/lib/admin/placeholders";
import { handler } from "@/lib/api/handler";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { placeholderConfirmSchema } from "@/shared/placeholders";

/**
 * Accepts stand-ins as real values without changing them. Each path also needs
 * the permission its value's save needs (`settings:update`, or
 * `content:update` for the location section). The public cache is
 * revalidated because a confirmed value starts to reach the geo meta, the
 * structured data and `llms.txt` (#29).
 */
export const POST = handler(
  { auth: { settings: ["read"] }, body: placeholderConfirmSchema },
  async ({ body, user, request }) => {
    const paths = await confirmPlaceholders(getDb(), {
      paths: body.paths,
      user,
      headers: request.headers,
    });
    revalidatePublic(publicTags.settings);
    return { paths };
  },
);
