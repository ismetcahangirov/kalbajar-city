import { getDb } from "@/db";
import { createLayoutType, listLayoutTypes } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { layoutTypeCreateSchema } from "@/shared/inventory";

/** Every layout type with its plan and number of apartments. */
export const GET = handler({ auth: { inventory: ["read"] } }, () => listLayoutTypes(getDb()));

export const POST = handler(
  { auth: { inventory: ["create"] }, body: layoutTypeCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createLayoutType(getDb(), { input: body, user, headers: request.headers }),
);
