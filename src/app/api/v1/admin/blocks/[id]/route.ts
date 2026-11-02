import { getDb } from "@/db";
import { deleteBlock, updateBlock } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { blockUpdateSchema, inventoryIdParamsSchema } from "@/shared/inventory";

export const PATCH = handler(
  { auth: { inventory: ["update"] }, params: inventoryIdParamsSchema, body: blockUpdateSchema },
  ({ params, body, user, request }) =>
    updateBlock(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Refused with 409 `IN_USE` while the block has floors. */
export const DELETE = handler(
  { auth: { inventory: ["delete"] }, params: inventoryIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteBlock(getDb(), { id: params.id, user, headers: request.headers });
  },
);
