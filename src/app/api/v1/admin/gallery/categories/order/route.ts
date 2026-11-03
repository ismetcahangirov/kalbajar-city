import { getDb } from "@/db";
import { reorderGalleryCategories } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";
import { orderSchema } from "@/shared/ordering";

/** Every category's id in the new order. */
export const PUT = handler(
  { auth: { content: ["update"] }, body: orderSchema },
  async ({ body, user, request }) => {
    await reorderGalleryCategories(getDb(), { input: body, user, headers: request.headers });
  },
);
