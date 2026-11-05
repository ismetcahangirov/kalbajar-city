import { getDb } from "@/db";
import { getSelectorView } from "@/lib/admin/selector";
import { handler } from "@/lib/api/handler";
import { selectorViewQuerySchema } from "@/shared/selector";

/** The site (`?`), a block's facade (`?block=`) or a floor's plan (`?floor=`), with its hotspots. */
export const GET = handler(
  { auth: { inventory: ["read"] }, query: selectorViewQuerySchema },
  ({ query }) => getSelectorView(getDb(), query),
);
