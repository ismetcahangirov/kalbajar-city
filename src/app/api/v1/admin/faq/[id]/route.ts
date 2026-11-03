import { getDb } from "@/db";
import { deleteFaq, updateFaq } from "@/lib/admin/faq";
import { handler } from "@/lib/api/handler";
import { faqIdParamsSchema, faqUpdateSchema } from "@/shared/faq";

/** Edits a question; changing its status also needs `content:publish`. */
export const PATCH = handler(
  { auth: { content: ["update"] }, params: faqIdParamsSchema, body: faqUpdateSchema },
  ({ params, body, user, request }) =>
    updateFaq(getDb(), { id: params.id, input: body, user, headers: request.headers }),
);

export const DELETE = handler(
  { auth: { content: ["delete"] }, params: faqIdParamsSchema },
  async ({ params, user, request }) => {
    await deleteFaq(getDb(), { id: params.id, user, headers: request.headers });
  },
);
