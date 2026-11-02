import { getDb } from "@/db";
import { createNews, listNews } from "@/lib/admin/news";
import { handler } from "@/lib/api/handler";
import { contentListQuerySchema, newsCreateSchema } from "@/shared/content";

/** Every article, drafts included (#25 builds the screen). */
export const GET = handler(
  { auth: { content: ["read"] }, query: contentListQuerySchema },
  ({ query }) => listNews(getDb(), query),
);

/** A new article, as a draft. */
export const POST = handler(
  { auth: { content: ["create"] }, body: newsCreateSchema, status: 201 },
  ({ body, user, request }) => createNews(getDb(), { input: body, user, headers: request.headers }),
);
