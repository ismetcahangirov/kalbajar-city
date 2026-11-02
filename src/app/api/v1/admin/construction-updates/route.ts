import { getDb } from "@/db";
import { createConstructionUpdate, listConstructionUpdates } from "@/lib/admin/construction";
import { handler } from "@/lib/api/handler";
import { constructionUpdateCreateSchema, contentListQuerySchema } from "@/shared/content";

/** Every update, drafts included, newest month first (#25 builds the screen). */
export const GET = handler(
  { auth: { content: ["read"] }, query: contentListQuerySchema },
  ({ query }) => listConstructionUpdates(getDb(), query),
);

/** A new update, as a draft. */
export const POST = handler(
  { auth: { content: ["create"] }, body: constructionUpdateCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createConstructionUpdate(getDb(), { input: body, user, headers: request.headers }),
);
