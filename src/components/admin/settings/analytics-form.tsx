"use client";

import { TextField } from "@/components/admin/form/fields";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { t } from "@/lib/admin/messages";
import {
  analyticsFormSchema,
  analyticsToForm,
  type AnalyticsForm as FormValues,
} from "@/lib/admin/settings-forms";
import type { SettingsValue } from "@/shared/settings";
import { useUpdateSettingMutation } from "@/store/endpoints/admin-settings";

import { SettingsForm } from "./settings-form";

type Analytics = SettingsValue<"analytics">;

/** The measurement IDs; the site loads no tracking script yet, whatever is set here. */
export function AnalyticsForm({ initial, readOnly }: { initial: Analytics; readOnly: boolean }) {
  const [save] = useUpdateSettingMutation();
  const form = useAdminForm(analyticsFormSchema, { defaultValues: analyticsToForm(initial) });

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => {
        const saved = await save({ key: "analytics", value }).unwrap();
        return analyticsToForm(saved.value as Analytics);
      }}
    >
      <TextField<FormValues>
        name="googleAnalyticsId"
        label={t("settings.analytics.ga")}
        description={t("settings.analytics.gaHint")}
        autoComplete="off"
        spellCheck={false}
        placeholder="G-XXXXXXXXXX"
      />
      <TextField<FormValues>
        name="metaPixelId"
        label={t("settings.analytics.pixel")}
        description={t("settings.analytics.pixelHint")}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
      />
    </SettingsForm>
  );
}
