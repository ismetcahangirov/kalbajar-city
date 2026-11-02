import { getDb } from "@/db";
import { listAdminApartments } from "@/lib/admin/apartments";
import { handler } from "@/lib/api/handler";
import { adminApartmentListQuerySchema } from "@/shared/apartments";

/** Every apartment, any status, for the inventory module (#24). */
export const GET = handler(
  { auth: { inventory: ["read"] }, query: adminApartmentListQuerySchema },
  ({ query }) => listAdminApartments(getDb(), query),
);
