import { getDb } from "@/db";
import { importApartments } from "@/lib/admin/inventory-import";
import { handler } from "@/lib/api/handler";
import { importRequestSchema } from "@/shared/inventory-csv";

/**
 * Imports the apartments CSV in one transaction (`importApartments`). A dry
 * run answers what a real run would do and writes nothing.
 */
export const POST = handler(
  { auth: { inventory: ["create", "update", "delete"] }, body: importRequestSchema },
  ({ body, user, request }) =>
    importApartments(getDb(), { input: body, user, headers: request.headers }),
);
