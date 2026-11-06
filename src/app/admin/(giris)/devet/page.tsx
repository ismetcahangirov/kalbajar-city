import type { Metadata } from "next";
import { connection } from "next/server";

import { FormAlert } from "@/components/admin/form-alert";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { openInvitation } from "@/lib/admin/invitations";
import { roleLabel, t } from "@/lib/admin/messages";
import { adminPaths } from "@/lib/auth/paths";

import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: t("invite.acceptTitle") };

export const instant = false;

/**
 * Where an invitation e-mail lands, with ?token=…. Opening it does not use the
 * invitation up; only submitting the form does.
 */
export default async function InvitationPage({ searchParams }: PageProps<"/admin/devet">) {
  await connection();
  const { token } = await searchParams;
  const invitation =
    typeof token === "string" && token.length <= 128 ? await openInvitation(getDb(), token) : null;

  if (typeof token !== "string" || !invitation) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-legacy-title">{t("invite.invalidTitle")}</h1>
        <FormAlert message={t("invite.invalid")} />
        <Button href={adminPaths.login}>{t("reset.backToLogin")}</Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-legacy-title">{t("invite.acceptTitle")}</h1>
      <p className="mt-2 mb-6 text-small text-text-muted">
        {t("invite.acceptLead", { email: invitation.email, role: roleLabel(invitation.role) })}
      </p>
      <AcceptForm token={token} />
    </>
  );
}
