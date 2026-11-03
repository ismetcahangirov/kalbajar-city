import { getDb } from "@/db";
import { reorderGalleryItems } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";
import { galleryIdParamsSchema } from "@/shared/gallery";
import { orderSchema } from "@/shared/ordering";

/** Every item of the category, by id, in the new order. */
export const PUT = handler(
  { auth: { content: ["update"] }, params: galleryIdParamsSchema, body: orderSchema },
  async ({ params, body, user, request }) => {
    await reorderGalleryItems(getDb(), {
      categoryId: params.id,
      input: body,
      user,
      headers: request.headers,
    });
  },
);
