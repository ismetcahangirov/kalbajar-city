"use client";

import { useWatch } from "react-hook-form";

import { TextField } from "@/components/admin/form/fields";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { t } from "@/lib/admin/messages";
import {
  developerFormSchema,
  developerToForm,
  type DeveloperForm as FormValues,
} from "@/lib/admin/settings-forms";
import type { SettingsValue } from "@/shared/settings";
import { useUpdateSettingMutation } from "@/store/endpoints/admin-settings";

import { MediaField } from "./media-field";
import { SettingsForm } from "./settings-form";

type Developer = SettingsValue<"developer">;

/** The developer: name, links and the logo the structured data names. */
export function DeveloperForm({
  initial,
  readOnly,
  canUpload,
}: {
  initial: Developer;
  readOnly: boolean;
  canUpload: boolean;
}) {
  const [save] = useUpdateSettingMutation();
  const form = useAdminForm(developerFormSchema, { defaultValues: developerToForm(initial) });
  const logo = useWatch({ control: form.control, name: "logoMediaId" });

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => {
        const saved = await save({ key: "developer", value }).unwrap();
        return developerToForm(saved.value as Developer);
      }}
    >
      <TextField<FormValues> name="name" label={t("settings.developer.name")} autoComplete="off" />
      <TextField<FormValues>
        name="instagram"
        label={t("settings.developer.instagram")}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://"
      />
      <TextField<FormValues>
        name="website"
        label={t("settings.developer.website")}
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://"
      />
      <MediaField
        label={t("settings.developer.logo")}
        description={t("settings.developer.logoHint")}
        value={logo ?? null}
        disabled={readOnly}
        canUpload={canUpload}
        onChange={(id) =>
          form.setValue("logoMediaId", id, { shouldDirty: true, shouldValidate: true })
        }
      />
    </SettingsForm>
  );
}
