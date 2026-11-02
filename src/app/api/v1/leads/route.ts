import { getDb } from "@/db";
import { handler } from "@/lib/api/handler";
import { createLead } from "@/lib/leads/create";
import { leadSubmissionSchema, type LeadCreated } from "@/shared/leads";

/** A lead from the inquiry, viewing or call-back form. */
export const POST = handler(
  { body: leadSubmissionSchema, status: 201 },
  ({ body }): Promise<LeadCreated> => createLead(getDb(), body),
);
