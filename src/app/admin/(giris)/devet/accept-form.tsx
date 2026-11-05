"use client";

import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/admin/form-alert";
import { formError } from "@/components/admin/form-error";
import { PasswordInput } from "@/components/admin/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import { adminPaths, passwordLength } from "@/lib/auth/paths";
import { fieldErrors } from "@/shared/auth";
import { acceptFormSchema } from "@/shared/users";
import { useAcceptInvitationMutation } from "@/store/endpoints/admin-users";

export function AcceptForm({ token }: { token: string }) {
  const [accept, { isLoading }] = useAcceptInvitationMutation();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = acceptFormSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    setAlert(null);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    try {
      await accept({ token, ...parsed.data }).unwrap();
      setDone(true);
    } catch (error) {
      setAlert(apiErrorMessage(error));
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert tone="success" message={t("invite.accepted")} />
        <Button href={adminPaths.login}>{t("login.submit")}</Button>
      </div>
    );
  }

  // POST, so a submit before hydration never puts the fields in the URL.
  return (
    <form method="post" onSubmit={onSubmit} noValidate>
      <FormAlert message={alert} className="mb-5" />
      <div className="flex flex-col gap-5">
        <Input
          id="name"
          name="name"
          label={t("invite.nameLabel")}
          autoComplete="name"
          required
          error={formError(errors.name)}
        />
        <PasswordInput
          id="password"
          name="password"
          label={t("field.password")}
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
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? t("invite.accepting") : t("invite.accept")}
        </Button>
      </div>
    </form>
  );
}
