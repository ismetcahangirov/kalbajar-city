"use client";

import { useState, type ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { toast } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { applyApiErrors } from "@/components/admin/form/use-admin-form";
import { FormAlert } from "@/components/admin/form-alert";
import { Button } from "@/components/admin/ui/button";
import { Form } from "@/components/admin/ui/form";
import { t } from "@/lib/admin/messages";

/**
 * One settings section's form (#27): its own save button, a toast when it is
 * saved, the API's field errors on their inputs, and a guard against leaving
 * with unsaved changes. `onSave` sends the value and answers the saved value
 * as form values, which become the new starting point. A read-only user sees
 * the values without the button.
 */
export function SettingsForm<TIn extends FieldValues, TOut>({
  form,
  onSave,
  beforeSave,
  readOnly,
  children,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  onSave: (values: TOut) => Promise<TIn>;
  /** Asked first; `false` cancels the save (a confirmation). */
  beforeSave?: (values: TOut) => Promise<boolean>;
  readOnly: boolean;
  children: ReactNode;
}) {
  const [alert, setAlert] = useState<string | null>(null);
  const { isDirty, isSubmitting } = form.formState;
  useUnsavedChangesGuard(isDirty && !readOnly);

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    if (beforeSave && !(await beforeSave(values))) return;
    try {
      form.reset(await onSave(values));
      toast.success(t("settings.saved"));
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });

  return (
    <Form {...form}>
      <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
        <fieldset disabled={readOnly || isSubmitting} className="flex min-w-0 flex-col gap-6">
          {children}
        </fieldset>
        <FormAlert message={alert} />
        {readOnly ? (
          <p className="text-sm text-muted-foreground">{t("settings.readOnly")}</p>
        ) : (
          <Button type="submit" className="self-start" disabled={isSubmitting}>
            {isSubmitting ? t("settings.saving") : t("settings.save")}
          </Button>
        )}
      </form>
    </Form>
  );
}
