import { getDb } from "@/db";
import { createFloor, listFloors } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { floorCreateSchema, floorListQuerySchema } from "@/shared/inventory";

/** One block's floors (`?block=<id>`), or every floor, with their plans. */
export const GET = handler(
  { auth: { inventory: ["read"] }, query: floorListQuerySchema },
  ({ query }) => listFloors(getDb(), query),
);

export const POST = handler(
  { auth: { inventory: ["create"] }, body: floorCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createFloor(getDb(), { input: body, user, headers: request.headers }),
);
