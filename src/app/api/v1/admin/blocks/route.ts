import { getDb } from "@/db";
import { createBlock, listBlocks } from "@/lib/admin/inventory";
import { handler } from "@/lib/api/handler";
import { blockCreateSchema } from "@/shared/inventory";

/** Every block, in display order, with its numbers of floors and apartments. */
export const GET = handler({ auth: { inventory: ["read"] } }, () => listBlocks(getDb()));

export const POST = handler(
  { auth: { inventory: ["create"] }, body: blockCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createBlock(getDb(), { input: body, user, headers: request.headers }),
);
