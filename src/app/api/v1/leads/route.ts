import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { getDb } from "@/db";
import { apiError } from "@/lib/api/errors";
import { handler } from "@/lib/api/handler";
import { clientKey } from "@/lib/http/client-ip";
import { createLead } from "@/lib/leads/create";
import { notifyLead } from "@/lib/leads/notify";
import { leadRateLimit, spamReason } from "@/lib/leads/spam";
import { leadSubmissionSchema, type LeadCreated } from "@/shared/leads";

const submit = handler(
  { body: leadSubmissionSchema, status: 201 },
  async ({ body }): Promise<LeadCreated> => {
    const spam = spamReason(body);
    if (spam) {
      // Answered like a stored lead, so a bot learns nothing from the reply.
      console.debug(`Lead dropped as spam: ${spam}`);
      return { id: randomUUID() };
    }
    const db = getDb();
    const lead = await createLead(db, body);
    // After the answer, and so after the commit: a slow or failing mail
    // server neither delays the visitor nor loses the lead.
    after(() => notifyLead(db, lead.id));
    return lead;
  },
);

/**
 * A lead from the inquiry, viewing or call-back form. Every attempt counts
 * towards the client's rate limit, valid or not, before the body is read.
 */
export async function POST(request: Request): Promise<Response> {
  // A client whose IP is unknown (no trusted header) shares one key with every
  // other such client: limited together, never exempt.
  const limit = leadRateLimit.hit(clientKey(request.headers));
  if (!limit.ok) {
    const response = apiError(429, "RATE_LIMITED", "Too many submissions. Try again later.");
    response.headers.set("Retry-After", String(limit.retryAfter));
    return response;
  }
  return submit(request);
}
