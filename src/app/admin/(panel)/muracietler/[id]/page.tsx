import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { LeadDetail } from "@/components/admin/leads/lead-detail";
import { getDb } from "@/db";
import { assignableUsers, getAdminLead, seesAllLeads } from "@/lib/admin/leads";
import { t } from "@/lib/admin/messages";
import { adminModules } from "@/lib/admin/navigation";
import { HttpError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";

// The title stays generic: a lead's name would end up in the browser's history.
export const metadata: Metadata = { title: t("leads.detailTitle") };

export const instant = false;

/**
 * One lead (#26); the sales e-mail links here. A sales user opening a lead
 * assigned to someone else gets the 403 page, as the API answers.
 */
export default async function LeadPage({ params }: PageProps<"/admin/muracietler/[id]">) {
  const user = await requireUser(adminModules.leads.permission);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await connection();
  const db = getDb();

  let lead;
  try {
    lead = await getAdminLead(db, id, user);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    if (error instanceof HttpError && error.status === 403) forbidden();
    throw error;
  }
  const canAssign = seesAllLeads(user.role);
  const assignees = canAssign ? await assignableUsers(db) : [];

  return <LeadDetail initial={lead} viewer={{ id: user.id, canAssign }} assignees={assignees} />;
}
