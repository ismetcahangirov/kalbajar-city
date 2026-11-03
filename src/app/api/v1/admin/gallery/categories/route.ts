import { getDb } from "@/db";
import { createGalleryCategory } from "@/lib/admin/gallery";
import { handler } from "@/lib/api/handler";
import { galleryCategoryCreateSchema } from "@/shared/gallery";

/** A new category, at the end. */
export const POST = handler(
  { auth: { content: ["create"] }, body: galleryCategoryCreateSchema, status: 201 },
  ({ body, user, request }) =>
    createGalleryCategory(getDb(), { input: body, user, headers: request.headers }),
);
