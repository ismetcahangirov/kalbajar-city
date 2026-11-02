import { handler } from "@/lib/api/handler";
import { listPublicLayoutTypes } from "@/lib/public/apartments";
import { localeOnlyQuerySchema } from "@/shared/apartments";

/** Every layout type with its plan and how many apartments are available. */
export const GET = handler({ query: localeOnlyQuerySchema }, ({ query }) =>
  listPublicLayoutTypes(query.locale),
);
