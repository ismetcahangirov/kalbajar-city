import { getDb } from "@/db";
import { csvResponse, exportApartmentsCsv } from "@/lib/admin/apartments";
import { handler } from "@/lib/api/handler";
import { adminApartmentListQuerySchema } from "@/shared/apartments";

/** The apartments the list's filters match, every page, as the CSV the importer reads. */
export const GET = handler(
  { auth: { inventory: ["read"] }, query: adminApartmentListQuerySchema },
  async ({ query }) => {
    const day = new Date().toISOString().slice(0, 10);
    return csvResponse(await exportApartmentsCsv(getDb(), query), `menziller-${day}.csv`);
  },
);
