import { getDb } from "@/db";
import { deleteGalleryItem, updateGalleryItem } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";
import { galleryIdParamsSchema, galleryItemUpdateSchema } from "@/shared/gallery";

/** Edits an item; changing its status also needs `content:publish`. */
export const PATCH = handler(
  { auth: { content: ["update"] }, params: galleryIdParamsSchema, body: galleryItemUpdateSchema },
  ({ params, body, user, request }) =>
    updateGalleryItem(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

/** Removes the item from the gallery; its file stays in the library. */
export const DELETE = handler(
  { auth: { content: ["delete"] }, params: galleryIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteGalleryItem(getDb(), { id: params.id, user, headers: request.headers });
  },
);
