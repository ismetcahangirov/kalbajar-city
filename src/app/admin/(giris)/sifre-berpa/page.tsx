import type { Metadata } from "next";

import { FormAlert } from "@/components/admin/form-alert";
import { t } from "@/lib/admin/messages";

import { NewPasswordForm } from "./new-password-form";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: t("reset.title") };

// The e-mailed link lands here with ?token=…, or with ?error=INVALID_TOKEN
// when the token has expired or was already used.
export const instant = false;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/sifre-berpa">) {
  const { token, error } = await searchParams;

  if (typeof token === "string" && token) {
    return (
      <>
        <h1 className="text-legacy-title">{t("reset.newTitle")}</h1>
        <p className="mt-2 mb-6 text-small text-text-muted">{t("reset.newLead")}</p>
        <NewPasswordForm token={token} />
      </>
    );
  }

  return (
    <>
      <h1 className="text-legacy-title">{t("reset.title")}</h1>
      <p className="mt-2 mb-6 text-small text-text-muted">{t("reset.lead")}</p>
      {error ? <FormAlert message={t("error.invalidToken")} className="mb-5" /> : null}
      <ResetRequestForm />
    </>
  );
}
