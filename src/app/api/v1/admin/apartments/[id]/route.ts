import { getDb } from "@/db";
import { deleteApartment, getAdminApartment, updateApartment } from "@/lib/admin/apartments";
import { handler } from "@/lib/api/handler";
import { apartmentIdParamsSchema, apartmentUpdateSchema } from "@/shared/apartments";

export const GET = handler(
  { auth: { inventory: ["read"] }, params: apartmentIdParamsSchema },
  ({ params }) => getAdminApartment(getDb(), params.id),
);

/** Status (sales may) or anything else (inventory editors only). */
export const PATCH = handler(
  {
    auth: { apartmentStatus: ["update"] },
    params: apartmentIdParamsSchema,
    body: apartmentUpdateSchema,
  },
  ({ params, body, user, request }) =>
    updateApartment(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Leads from the apartment keep their details and lose the link. */
export const DELETE = handler(
  { auth: { inventory: ["delete"] }, params: apartmentIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteApartment(getDb(), { id: params.id, user, headers: request.headers });
  },
);
