import { getDb } from "@/db";
import { createFaq, listFaq } from "@/lib/admin/faq";
import { handler } from "@/lib/api/handler";
import { faqCreateSchema } from "@/shared/faq";

/** Every question, drafts included, in the site's order. */
export const GET = handler({ auth: { content: ["read"] } }, () => listFaq(getDb()));

/** A new question, at the end of the list. */
export const POST = handler(
  { auth: { content: ["create"] }, body: faqCreateSchema, status: 201 },
  ({ body, user, request }) => createFaq(getDb(), { input: body, user, headers: request.headers }),
);
