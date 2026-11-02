"use client";

import { z } from "zod";

import { FormAlert } from "@/components/admin/form-alert";
import { TextField, TextareaField } from "@/components/admin/form/fields";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { toast } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { Button } from "@/components/admin/ui/button";
import { Form } from "@/components/admin/ui/form";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import { settingsSchemas, type SettingsValue } from "@/shared/settings";
import { useUpdateLeadSettingsMutation } from "@/store/endpoints/admin-leads";

type LeadSettings = SettingsValue<"leads">;

const { shape } = settingsSchemas.leads;

/**
 * The form's view of `settingsSchemas.leads`: the recipients as one address
 * per line, which a phone's keyboard handles better than a list of inputs.
 * Each address is checked with the shared schema's own rule.
 */
const formSchema = z.object({
  recipients: z.string().superRefine((value, ctx) => {
    const list = splitRecipients(value);
    if (!shape.recipients.safeParse(list).success) {
      ctx.addIssue({ code: "custom", message: "leads.settings.recipientsInvalid" });
    }
  }),
  retentionMonths: z.coerce.number<string | number>().pipe(shape.retentionMonths),
});

type FormInput = z.input<typeof formSchema>;

function splitRecipients(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

/** Who gets the new-lead e-mail and how long leads are kept (owner and admin). */
export function LeadSettingsForm({ initial }: { initial: LeadSettings }) {
  const [save, { error, reset: resetError }] = useUpdateLeadSettingsMutation();
  const form = useAdminForm(formSchema, {
    defaultValues: {
      recipients: initial.recipients.join("\n"),
      retentionMonths: initial.retentionMonths,
    },
  });
  useUnsavedChangesGuard(form.formState.isDirty);

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex max-w-(--container-prose) flex-col gap-6"
        onSubmit={form.handleSubmit(async (values) => {
          resetError();
          try {
            const saved = await save({
              recipients: splitRecipients(values.recipients),
              retentionMonths: values.retentionMonths,
            }).unwrap();
            form.reset({
              recipients: saved.recipients.join("\n"),
              retentionMonths: saved.retentionMonths,
            });
            toast.success(t("leads.settings.saved"));
          } catch (cause) {
            applyApiErrors(form, cause);
          }
        })}
      >
        <TextareaField<FormInput>
          name="recipients"
          label={t("leads.settings.recipients")}
          description={t("leads.settings.recipientsHint")}
          rows={4}
          autoComplete="off"
          spellCheck={false}
        />
        <TextField<FormInput>
          name="retentionMonths"
          label={t("leads.settings.retention")}
          description={t("leads.settings.retentionHint")}
          type="number"
          inputMode="numeric"
          min={6}
          max={120}
          className="w-32"
        />
        <FormAlert message={error ? apiErrorMessage(error) : null} />
        <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
          {t("leads.settings.save")}
        </Button>
      </form>
    </Form>
  );
}
