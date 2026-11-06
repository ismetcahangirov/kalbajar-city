import { z } from "zod";

import { getDb } from "@/db";
import { getHomeSection, updateHomeSection } from "@/lib/admin/home-sections";
import { handler } from "@/lib/api/handler";
import { homeSectionKeys } from "@/shared/home-sections";

const params = z.object({ key: z.enum(homeSectionKeys) });

/** One home section (#17). `location` has its own route file, for the settings screen. */
export const GET = handler({ auth: { content: ["read"] }, params }, ({ params }) =>
  getHomeSection(getDb(), params.key),
);

/** Replaces the section's content; it is validated against the section's schema. */
export const PUT = handler(
  { auth: { content: ["update"] }, params, body: z.unknown() },
  ({ params, body, user, request }) =>
    updateHomeSection(getDb(), {
      key: params.key,
      content: body,
      user,
      headers: request.headers,
    }),
);
