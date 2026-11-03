import { getDb } from "@/db";
import { createGalleryItem } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";
import { galleryItemCreateSchema } from "@/shared/gallery";

/** A library image added to the end of a category. */
export const POST = handler(
  { auth: { content: ["create"] }, body: galleryItemCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createGalleryItem(getDb(), { input: body, user, headers: request.headers }),
);
