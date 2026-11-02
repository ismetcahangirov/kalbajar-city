import { z } from "zod";

import { getDb } from "@/db";
import { getHomeSection, updateHomeSection } from "@/lib/admin/home-sections";
import { handler } from "@/lib/api/handler";

/** The home page's location section, which the location page also reads (#27). */
export const GET = handler({ auth: { content: ["read"] } }, () =>
  getHomeSection(getDb(), "location"),
);

/** Replaces the section's content; it is validated against the section's schema. */
export const PUT = handler(
  { auth: { content: ["update"] }, body: z.unknown() },
  ({ body, user, request }) =>
    updateHomeSection(getDb(), {
      key: "location",
      content: body,
      user,
      headers: request.headers,
    }),
);
