import { getDb } from "@/db";
import { setNewsPublished } from "@/lib/admin/news";
import { handler } from "@/lib/api/handler";
import { contentIdParamsSchema, publicationSchema } from "@/shared/content";

/** Publishes the article; it shows on `/xeberler` on the next request. */
export const PUT = handler(
  { auth: { content: ["publish"] }, params: contentIdParamsSchema, body: publicationSchema },
  ({ params, body, user, request }) =>
    setNewsPublished(getDb(), {
      id: params.id,
      publish: true,
      input: body,
      user,
      headers: request.headers,
    }),
);

/** Withdraws the article to a draft. */
export const DELETE = handler(
  { auth: { content: ["publish"] }, params: contentIdParamsSchema },
  ({ params, user, request }) =>
    setNewsPublished(getDb(), { id: params.id, publish: false, user, headers: request.headers }),
);
