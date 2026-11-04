import { getDb } from "@/db";
import { setSelectorHotspot } from "@/lib/admin/selector";
import { handler } from "@/lib/api/handler";
import { selectorHotspotSchema } from "@/shared/selector";

/** Draws or clears one hotspot: a block on the site, a floor on a facade, an apartment on a plan. */
export const PUT = handler(
  { auth: { inventory: ["update"] }, body: selectorHotspotSchema },
  ({ body, user, request }) =>
    setSelectorHotspot(getDb(), { input: body, user, headers: request.headers }),
);
