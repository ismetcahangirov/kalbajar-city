import { getDb } from "@/db";
import { setConstructionUpdateMedia } from "@/lib/admin/construction";
import { handler } from "@/lib/api/handler";
import { contentIdParamsSchema, contentMediaSchema } from "@/shared/content";

/** The update's photos and video, in order: attach, detach and reorder in one call. */
export const PUT = handler(
  { auth: { content: ["update"] }, params: contentIdParamsSchema, body: contentMediaSchema },
  ({ params, body, user, request }) =>
    setConstructionUpdateMedia(getDb(), {
      id: params.id,
      mediaIds: body.mediaIds,
      user,
      headers: request.headers,
    }),
);
