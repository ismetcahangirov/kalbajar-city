import { getDb } from "@/db";
import {
  deleteConstructionUpdate,
  getConstructionUpdate,
  updateConstructionUpdate,
} from "@/lib/admin/construction";
import { handler } from "@/lib/api/handler";
import { constructionUpdateUpdateSchema, contentIdParamsSchema } from "@/shared/content";

export const GET = handler(
  { auth: { content: ["read"] }, params: contentIdParamsSchema },
  ({ params }) => getConstructionUpdate(getDb(), params.id),
);

export const PATCH = handler(
  {
    auth: { content: ["update"] },
    params: contentIdParamsSchema,
    body: constructionUpdateUpdateSchema,
  },
  ({ params, body, user, request }) =>
    updateConstructionUpdate(getDb(), {
      id: params.id,
      input: body,
      user,
      headers: request.headers,
    }),
);

export const DELETE = handler(
  { auth: { content: ["delete"] }, params: contentIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteConstructionUpdate(getDb(), { id: params.id, user, headers: request.headers });
  },
);
