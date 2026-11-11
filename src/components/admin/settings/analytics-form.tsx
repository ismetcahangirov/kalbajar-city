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

/**
 * The measurement IDs, and the search engines' site-verification tokens that
 * every public page then carries in its `<head>` (#28, #29).
 */
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
      <fieldset className="flex min-w-0 flex-col gap-6">
        <legend className="text-sm mb-2 font-medium">{t("settings.analytics.verification")}</legend>
        <TextField<FormValues>
          name="googleSiteVerification"
          label={t("settings.analytics.google")}
          description={t("settings.analytics.googleHint")}
          autoComplete="off"
          spellCheck={false}
        />
        <TextField<FormValues>
          name="bingSiteVerification"
          label={t("settings.analytics.bing")}
          description={t("settings.analytics.bingHint")}
          autoComplete="off"
          spellCheck={false}
        />
      </fieldset>
    </SettingsForm>
  );
}
