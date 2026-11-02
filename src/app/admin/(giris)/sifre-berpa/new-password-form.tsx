"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/admin/form-alert";
import { formError } from "@/components/admin/form-error";
import { PasswordInput } from "@/components/admin/password-input";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/admin/messages";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { adminPaths, passwordLength } from "@/lib/auth/paths";
import { fieldErrors, newPasswordSchema } from "@/shared/auth";

export function NewPasswordForm({ token }: { token: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = newPasswordSchema.safeParse(input);
    setAlert(null);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    setPending(false);
    if (result.error) setAlert(authErrorMessage(result.error));
    else setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success" message={t("reset.done")} />
        <Button href={adminPaths.login}>{t("reset.backToLogin")}</Button>
      </div>
    );
  }

  // POST, so a submit before hydration never puts the fields in the URL.
  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FormAlert message={alert} className="mb-5" />
      <div className="flex flex-col gap-5">
        <PasswordInput
          id="password"
          name="password"
          label={t("field.newPassword")}
          helper={t("field.passwordHint", passwordLength)}
          autoComplete="new-password"
          required
          error={formError(errors.password)}
        />
        <PasswordInput
          id="confirm"
          name="confirm"
          label={t("field.confirmPassword")}
          autoComplete="new-password"
          required
          error={formError(errors.confirm)}
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("reset.saving") : t("reset.save")}
        </Button>
      </div>
    </form>
  );
}
