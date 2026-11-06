import { getDb } from "@/db";
import { saveHomeSectionOrder } from "@/lib/admin/home-sections";
import { handler } from "@/lib/api/handler";
import { homeSectionOrderSchema } from "@/shared/home-sections";

/** The sections in the new order and whether each shows; answers the saved list. */
export const PUT = handler(
  { auth: { content: ["update"] }, body: homeSectionOrderSchema },
  ({ body, user, request }) =>
    saveHomeSectionOrder(getDb(), { input: body, user, headers: request.headers }),
);
