import { getDb } from "@/db";
import { setConstructionUpdatePublished } from "@/lib/admin/construction";
import { handler } from "@/lib/api/handler";
import { contentIdParamsSchema, publicationSchema } from "@/shared/content";

/** Publishes the update; it shows on `/tikinti` and the home page on the next request. */
export const PUT = handler(
  { auth: { content: ["publish"] }, params: contentIdParamsSchema, body: publicationSchema },
  ({ params, body, user, request }) =>
    setConstructionUpdatePublished(getDb(), {
      id: params.id,
      publish: true,
      input: body,
      user,
      headers: request.headers,
    }),
);

/** Withdraws the update to a draft. */
export const DELETE = handler(
  { auth: { content: ["publish"] }, params: contentIdParamsSchema },
  ({ params, user, request }) =>
    setConstructionUpdatePublished(getDb(), {
      id: params.id,
      publish: false,
      user,
      headers: request.headers,
    }),
);
