"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormAlert } from "@/components/admin/form-alert";
import { formError } from "@/components/admin/form-error";
import { PasswordInput } from "@/components/admin/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/admin/messages";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { adminPaths, safeAdminRedirect } from "@/lib/auth/paths";
import { fieldErrors, signInSchema } from "@/shared/auth";

/** `next` is the console page the visitor asked for before signing in. */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse(Object.fromEntries(form));
    setAlert(null);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    const { error } = await authClient.signIn.email({ ...parsed.data, rememberMe: true });
    if (error) {
      setPending(false);
      setAlert(authErrorMessage(error));
      return;
    }
    router.replace(safeAdminRedirect(next));
    router.refresh();
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
          error={formError(errors.email)}
        />
        <PasswordInput
          id="password"
          name="password"
          label={t("field.password")}
          autoComplete="current-password"
          required
          error={formError(errors.password)}
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("login.submitting") : t("login.submit")}
        </Button>
        <Link
          href={adminPaths.resetPassword}
          className="inline-flex min-h-target items-center self-start text-small underline underline-offset-4"
        >
          {t("login.forgot")}
        </Link>
      </div>
    </form>
  );
}
