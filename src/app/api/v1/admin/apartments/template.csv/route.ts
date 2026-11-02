import { getDb } from "@/db";
import { apartmentsCsvTemplate, csvResponse } from "@/lib/admin/apartments";
import { handler } from "@/lib/api/handler";

/** The import template: the header and one example row. */
export const GET = handler({ auth: { inventory: ["read"] } }, async () =>
  csvResponse(await apartmentsCsvTemplate(getDb()), "menziller-sablon.csv"),
);
