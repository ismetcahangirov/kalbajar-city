import { createUploadTicket } from "@/lib/admin/media";
import { handler } from "@/lib/api/handler";
import { uploadRequestSchema } from "@/shared/media";

/**
 * Step one of an upload (#11): a presigned PUT for the file, which goes from
 * the browser straight to the bucket. Step two is `POST /api/v1/admin/media`.
 */
export const POST = handler(
  { auth: { media: ["upload"] }, body: uploadRequestSchema, status: 201 },
  ({ body }) => createUploadTicket(body),
);
