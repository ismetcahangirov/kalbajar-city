import { getDb } from "@/db";
import { setSelectorPicture } from "@/lib/admin/selector";
import { handler } from "@/lib/api/handler";
import { selectorPictureSchema } from "@/shared/selector";

/** Sets or clears the picture of a level; answers with the level as the editor shows it. */
export const PUT = handler(
  { auth: { inventory: ["update"] }, body: selectorPictureSchema },
  ({ body, user, request }) =>
    setSelectorPicture(getDb(), { input: body, user, headers: request.headers }),
);
