import { getDb } from "@/db";
import { deleteLayoutType, getLayoutType, updateLayoutType } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { inventoryIdParamsSchema, layoutTypeUpdateSchema } from "@/shared/inventory";

export const GET = handler(
  { auth: { inventory: ["read"] }, params: inventoryIdParamsSchema },
  ({ params }) => getLayoutType(getDb(), params.id),
);

export const PATCH = handler(
  {
    auth: { inventory: ["update"] },
    params: inventoryIdParamsSchema,
    body: layoutTypeUpdateSchema,
  },
  ({ params, body, user, request }) =>
    updateLayoutType(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Refused with 409 `IN_USE` while apartments use the layout. */
export const DELETE = handler(
  { auth: { inventory: ["delete"] }, params: inventoryIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteLayoutType(getDb(), { id: params.id, user, headers: request.headers });
  },
);
