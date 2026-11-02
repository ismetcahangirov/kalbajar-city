import { getDb } from "@/db";
import { deleteBuilding, updateBuilding } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { buildingUpdateSchema, inventoryIdParamsSchema } from "@/shared/inventory";

export const PATCH = handler(
  { auth: { inventory: ["update"] }, params: inventoryIdParamsSchema, body: buildingUpdateSchema },
  ({ params, body, user, request }) =>
    updateBuilding(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Refused with 409 `IN_USE` while the building has blocks. */
export const DELETE = handler(
  { auth: { inventory: ["delete"] }, params: inventoryIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteBuilding(getDb(), { id: params.id, user, headers: request.headers });
  },
);
