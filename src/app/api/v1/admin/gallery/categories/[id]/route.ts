import { getDb } from "@/db";
import { deleteGalleryCategory, updateGalleryCategory } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";
import { galleryCategoryUpdateSchema, galleryIdParamsSchema } from "@/shared/gallery";

export const PATCH = handler(
  {
    auth: { content: ["update"] },
    params: galleryIdParamsSchema,
    body: galleryCategoryUpdateSchema,
  },
  async ({ params, body, user, request }) => {
    await updateGalleryCategory(getDb(), {
      id: params.id,
      input: body,
      user,
      headers: request.headers,
    });
  },
);

/** Removes the category with its items; the files stay in the library. */
export const DELETE = handler(
  { auth: { content: ["delete"] }, params: galleryIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteGalleryCategory(getDb(), { id: params.id, user, headers: request.headers });
  },
);
