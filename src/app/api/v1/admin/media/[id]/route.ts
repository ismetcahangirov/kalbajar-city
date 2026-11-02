import { getDb } from "@/db";
import { deleteMedia, getMedia, updateMedia } from "@/lib/admin/media";
import { handler } from "@/lib/api/handler";
import { mediaIdParamsSchema, mediaUpdateSchema } from "@/shared/media";

/** One file with every place it is used. */
export const GET = handler(
  { auth: { media: ["read"] }, params: mediaIdParamsSchema },
  ({ params }) => getMedia(getDb(), params.id),
);

/** Alt text, caption, focus point, source and flags. */
export const PATCH = handler(
  { auth: { media: ["update"] }, params: mediaIdParamsSchema, body: mediaUpdateSchema },
  ({ params, body, user, request }) =>
    updateMedia(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Refused with 409 `MEDIA_IN_USE` and the file's `usages` while anything uses it. */
export const DELETE = handler(
  { auth: { media: ["delete"] }, params: mediaIdParamsSchema },
  ({ params, user, request }) =>
    deleteMedia(getDb(), { id: params.id, user, headers: request.headers }),
);
