"use client";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/admin/ui/form";
import { Switch } from "@/components/admin/ui/switch";
import { t } from "@/lib/admin/messages";
import { pricesFormSchema } from "@/lib/admin/settings-forms";
import type { SettingsValue } from "@/shared/settings";
import { useUpdateSettingMutation } from "@/store/endpoints/admin-settings";

import { SettingsForm } from "./settings-form";

type Prices = SettingsValue<"prices">;

/**
 * Whether the public site shows prices. The switch takes effect on save,
 * after a confirmation that says what changes for visitors.
 */
export function PricesForm({ initial, readOnly }: { initial: Prices; readOnly: boolean }) {
  const [save] = useUpdateSettingMutation();
  const confirm = useConfirm();
  const form = useAdminForm(pricesFormSchema, { defaultValues: initial });

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      beforeSave={(value) =>
        !form.formState.isDirty
          ? Promise.resolve(true)
          : confirm(
              value.visible
                ? {
                    title: t("settings.prices.showTitle"),
                    description: t("settings.prices.showLead"),
                    confirmLabel: t("settings.prices.show"),
                  }
                : {
                    title: t("settings.prices.hideTitle"),
                    description: t("settings.prices.hideLead"),
                    confirmLabel: t("settings.prices.hide"),
                  },
            )
      }
      onSave={async (value) => {
        const saved = await save({ key: "prices", value }).unwrap();
        return saved.value as Prices;
      }}
    >
      <FormField
        control={form.control}
        name="visible"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start justify-between gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-1">
              <FormLabel>{t("settings.prices.visible")}</FormLabel>
              <FormDescription>{t("settings.prices.visibleHint")}</FormDescription>
            </div>
            <FormControl>
              <Switch
                ref={field.ref}
                name={field.name}
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </SettingsForm>
  );
}
