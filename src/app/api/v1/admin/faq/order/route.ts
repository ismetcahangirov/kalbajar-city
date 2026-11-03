import { getDb } from "@/db";
import { reorderFaq } from "@/lib/admin/faq";
import { handler } from "@/lib/api/handler";
import { orderSchema } from "@/shared/ordering";

/** Every question's id in the new order; answers with the reordered list. */
export const PUT = handler(
  { auth: { content: ["update"] }, body: orderSchema },
  ({ body, user, request }) => reorderFaq(getDb(), { input: body, user, headers: request.headers }),
);
