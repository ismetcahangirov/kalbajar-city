"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/admin/form-alert";
import { formError } from "@/components/admin/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/admin/messages";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { adminPaths } from "@/lib/auth/paths";
import { fieldErrors, resetRequestSchema } from "@/shared/auth";

export function ResetRequestForm() {
  const [error, setError] = useState<string | undefined>();
  const [alert, setAlert] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = resetRequestSchema.safeParse(input);
    setAlert(null);
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email);
      return;
    }
    setError(undefined);
    setPending(true);
    const result = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: adminPaths.resetPassword,
    });
    setPending(false);
    // The answer is the same whether or not the address has an account.
    if (result.error) setAlert(authErrorMessage(result.error));
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success" message={t("reset.sent")} />
        <Button href={adminPaths.login} variant="secondary">
          {t("reset.backToLogin")}
        </Button>
      </div>
    );
  }

  // POST, so a submit before hydration never puts the fields in the URL.
  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FormAlert message={alert} className="mb-5" />
      <div className="flex flex-col gap-5">
        <Input
          id="email"
          name="email"
          type="email"
          label={t("field.email")}
          autoComplete="username"
          inputMode="email"
          required
          error={formError(error)}
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("reset.submitting") : t("reset.submit")}
        </Button>
        <Link
          href={adminPaths.login}
          className="inline-flex min-h-target items-center self-start text-small underline underline-offset-4"
        >
          {t("reset.backToLogin")}
        </Link>
      </div>
    </form>
  );
}
