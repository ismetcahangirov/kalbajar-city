"use client";

import { TextField } from "@/components/admin/form/fields";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { t } from "@/lib/admin/messages";
import {
  socialsFormSchema,
  socialsToForm,
  type SocialsForm as FormValues,
} from "@/lib/admin/settings-forms";
import type { SettingsValue } from "@/shared/settings";
import { useUpdateSettingMutation } from "@/store/endpoints/admin-settings";

import { SettingsForm } from "./settings-form";

type Socials = SettingsValue<"socials">;

const networks = ["instagram", "facebook", "youtube", "tiktok"] as const;

/** The complex's own social accounts; an empty one is left off the site. */
export function SocialsForm({ initial, readOnly }: { initial: Socials; readOnly: boolean }) {
  const [save] = useUpdateSettingMutation();
  const form = useAdminForm(socialsFormSchema, { defaultValues: socialsToForm(initial) });

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => {
        const saved = await save({ key: "socials", value }).unwrap();
        return socialsToForm(saved.value as Socials);
      }}
    >
      {networks.map((network) => (
        <TextField<FormValues>
          key={network}
          name={network}
          label={t(`settings.socials.${network}`)}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
        />
      ))}
      <p className="text-sm text-muted-foreground">{t("settings.socials.hint")}</p>
    </SettingsForm>
  );
}
