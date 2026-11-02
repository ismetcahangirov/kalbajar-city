import { getDb } from "@/db";
import { deleteNews, getNews, updateNews } from "@/lib/admin/news";
import { handler } from "@/lib/api/handler";
import { contentIdParamsSchema, newsUpdateSchema } from "@/shared/content";

export const GET = handler(
  { auth: { content: ["read"] }, params: contentIdParamsSchema },
  ({ params }) => getNews(getDb(), params.id),
);

export const PATCH = handler(
  { auth: { content: ["update"] }, params: contentIdParamsSchema, body: newsUpdateSchema },
  ({ params, body, user, request }) =>
    updateNews(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

export const DELETE = handler(
  { auth: { content: ["delete"] }, params: contentIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteNews(getDb(), { id: params.id, user, headers: request.headers });
  },
);
