import { getDb } from "@/db";
import { createMedia, listMedia } from "@/lib/admin/media";
import { handler } from "@/lib/api/handler";
import { mediaCreateSchema, mediaListQuerySchema } from "@/shared/media";

/** The media library (#25), newest first, by kind and source. */
export const GET = handler(
  { auth: { media: ["read"] }, query: mediaListQuerySchema },
  ({ query }) => listMedia(getDb(), query),
);

/** Step two of an upload: checks and processes the file, then adds it to the library. */
export const POST = handler(
  { auth: { media: ["upload"] }, body: mediaCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createMedia(getDb(), { input: body, user, headers: request.headers }),
);
