import { getDb } from "@/db";
import { deleteFloor, updateFloor } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { floorUpdateSchema, inventoryIdParamsSchema } from "@/shared/inventory";

export const PATCH = handler(
  { auth: { inventory: ["update"] }, params: inventoryIdParamsSchema, body: floorUpdateSchema },
  ({ params, body, user, request }) =>
    updateFloor(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Refused with 409 `IN_USE` while the floor has apartments. */
export const DELETE = handler(
  { auth: { inventory: ["delete"] }, params: inventoryIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteFloor(getDb(), { id: params.id, user, headers: request.headers });
  },
);
