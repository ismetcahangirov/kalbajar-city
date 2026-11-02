"use client";

import { useFieldArray, useWatch } from "react-hook-form";

import { SelectField, TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { t } from "@/lib/admin/messages";
import {
  complexFormSchema,
  complexToForm,
  type ComplexForm as FormValues,
} from "@/lib/admin/settings-forms";
import { amenityIcons, complexFactKeys, type SettingsValue } from "@/shared/settings";
import { useUpdateSettingMutation } from "@/store/endpoints/admin-settings";

import { ListEditor } from "./list-editor";
import { SettingsForm } from "./settings-form";

type Complex = SettingsValue<"complex">;

const decimalFacts = new Set([
  "totalArea",
  "residentialArea",
  "nonResidentialArea",
  "landHectares",
]);

const iconOptions = amenityIcons.map((icon) => ({ value: icon, label: t(`amenity.${icon}`) }));

/** The complex's facts, which the pages quote, and its amenities list. */
export function ComplexForm({ initial, readOnly }: { initial: Complex; readOnly: boolean }) {
  const [save] = useUpdateSettingMutation();
  const form = useAdminForm(complexFormSchema, { defaultValues: complexToForm(initial) });
  const amenities = useFieldArray({ control: form.control, name: "amenities" });
  const titles = useWatch({ control: form.control, name: "amenities" });

  const amenityLabel = (index: number) => {
    const title = (titles?.[index]?.title as { az?: string } | undefined)?.az?.trim();
    const position = t("settings.complex.amenity", { index: index + 1 });
    return title ? `${position}: ${title}` : position;
  };

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => {
        const saved = await save({ key: "complex", value }).unwrap();
        return complexToForm(saved.value as Complex);
      }}
    >
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm mb-2 font-medium">{t("settings.complex.facts")}</legend>
        <p className="text-sm text-muted-foreground">{t("settings.complex.factsHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {complexFactKeys.map((fact) => (
            <TextField<FormValues>
              key={fact}
              name={fact}
              label={t(`fact.${fact}`)}
              inputMode={decimalFacts.has(fact) ? "decimal" : "numeric"}
              autoComplete="off"
            />
          ))}
        </div>
      </fieldset>

      <ListEditor
        legend={t("settings.complex.amenities")}
        description={t("settings.complex.amenitiesHint")}
        ids={amenities.fields.map((field) => field.id)}
        itemLabel={amenityLabel}
        renderItem={(index) => (
          <>
            <SelectField<FormValues>
              name={`amenities.${index}.icon`}
              label={t("settings.complex.icon")}
              options={iconOptions}
              disabled={readOnly}
            />
            <TranslatableField<FormValues>
              name={`amenities.${index}.title`}
              label={t("settings.complex.amenityTitle")}
            />
            <TranslatableField<FormValues>
              name={`amenities.${index}.body`}
              label={t("settings.complex.amenityBody")}
              multiline
            />
          </>
        )}
        onMove={amenities.move}
        onRemove={amenities.remove}
        onAdd={() =>
          amenities.append({
            icon: "security",
            title: { az: "", en: "", ru: "" },
            body: { az: "", en: "", ru: "" },
          })
        }
        addLabel={t("settings.complex.addAmenity")}
        emptyText={t("settings.complex.noAmenities")}
        max={30}
        disabled={readOnly}
      />
    </SettingsForm>
  );
}
