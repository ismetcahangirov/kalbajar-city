import "server-only";

import { eq } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { apartments, leadEvents, leads } from "@/db/schema";
import { invalidField } from "@/lib/api/errors";
import type { leadSubmissionSchema } from "@/shared/leads";

type Submission = z.output<typeof leadSubmissionSchema>;

/**
 * Stores a lead from a public form with its `created` timeline entry. An
 * apartment slug that names no apartment is a field error, not a lost lead's
 * context.
 */
export async function createLead(db: Executor, input: Submission): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    let apartmentId: string | null = null;
    if (input.apartment) {
      const [apartment] = await tx
        .select({ id: apartments.id })
        .from(apartments)
        .where(eq(apartments.slug, input.apartment));
      if (!apartment) throw invalidField("apartment", "Unknown apartment");
      apartmentId = apartment.id;
    }

    const utm = Object.fromEntries(
      Object.entries(input.utm ?? {}).filter(([, value]) => value !== undefined),
    );
    const [lead] = await tx
      .insert(leads)
      .values({
        type: input.type,
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        message: input.message ?? null,
        preferredAt: input.type === "viewing" ? new Date(input.preferredAt) : null,
        apartmentId,
        locale: input.locale,
        sourcePath: input.sourcePath,
        utm: Object.keys(utm).length ? utm : null,
        referrer: input.referrer ?? null,
      })
      .returning({ id: leads.id });
    if (!lead) throw new Error("The lead was not stored");

    await tx
      .insert(leadEvents)
      .values({ leadId: lead.id, type: "created", data: { type: input.type } });
    return lead;
  });
}
