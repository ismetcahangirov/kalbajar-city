import { getDb } from "@/db";
import { bulkUpdateApartments, createApartment, listAdminApartments } from "@/lib/admin/apartments";
import { handler } from "@/lib/api/handler";
import {
  adminApartmentListQuerySchema,
  apartmentBulkSchema,
  apartmentCreateSchema,
} from "@/shared/apartments";

/** Every apartment, any status, for the inventory module (#24). */
export const GET = handler(
  { auth: { inventory: ["read"] }, query: adminApartmentListQuerySchema },
  ({ query }) => listAdminApartments(getDb(), query),
);

export const POST = handler(
  { auth: { inventory: ["create"] }, body: apartmentCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createApartment(getDb(), { input: body, user, headers: request.headers }),
);

/**
 * One change to many apartments in one transaction: status (sales may),
 * publish/unpublish (status changes too) or price (inventory editors only).
 */
export const PATCH = handler(
  { auth: { apartmentStatus: ["update"] }, body: apartmentBulkSchema },
  ({ body, user, request }) =>
    bulkUpdateApartments(getDb(), { input: body, user, headers: request.headers }),
);
