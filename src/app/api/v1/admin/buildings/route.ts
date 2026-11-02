import { getDb } from "@/db";
import { createBuilding, listBuildings } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { buildingCreateSchema } from "@/shared/inventory";

/** Every building, in display order, with its number of blocks. */
export const GET = handler({ auth: { inventory: ["read"] } }, () => listBuildings(getDb()));

export const POST = handler(
  { auth: { inventory: ["create"] }, body: buildingCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createBuilding(getDb(), { input: body, user, headers: request.headers }),
);
