"use client";

import { useFieldArray, useWatch } from "react-hook-form";

import { TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { t } from "@/lib/admin/messages";
import {
  locationFormSchema,
  locationToForm,
  type LocationForm as FormValues,
} from "@/lib/admin/settings-forms";
import type { HomeSectionContentByKey } from "@/shared/home-sections";
import { useUpdateLocationSectionMutation } from "@/store/endpoints/admin-settings";

import { ListEditor } from "./list-editor";
import { MediaField } from "./media-field";
import { PlaceholderFlag } from "./placeholders";
import { SettingsForm } from "./settings-form";

type Location = HomeSectionContentByKey["location"];

/**
 * The home page's location section, which the location page also reads:
 * its copy, the static map image, the directions and the distances list.
 */
export function LocationForm({
  initial,
  readOnly,
  canUpload,
}: {
  initial: Location;
  readOnly: boolean;
  canUpload: boolean;
}) {
  const [save] = useUpdateLocationSectionMutation();
  const form = useAdminForm(locationFormSchema, { defaultValues: locationToForm(initial) });
  const distances = useFieldArray({ control: form.control, name: "distances" });
  const values = useWatch({ control: form.control, name: "distances" });
  const map = useWatch({ control: form.control, name: "mapMediaId" });

  const distanceLabel = (index: number) => {
    const place = (values?.[index]?.place as { az?: string } | undefined)?.az?.trim();
    const position = t("settings.location.distance", { index: index + 1 });
    return place ? `${position}: ${place}` : position;
  };

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => {
        const saved = await save(value).unwrap();
        return locationToForm(saved.content);
      }}
    >
      <TranslatableField<FormValues> name="title" label={t("settings.location.title")} />
      <TranslatableField<FormValues> name="body" label={t("settings.location.body")} multiline />
      <MediaField
        label={t("settings.location.map")}
        description={t("settings.location.mapHint")}
        value={map ?? null}
        disabled={readOnly}
        canUpload={canUpload}
        onChange={(id) =>
          form.setValue("mapMediaId", id, { shouldDirty: true, shouldValidate: true })
        }
      />
      <div className="flex flex-col gap-2">
        <PlaceholderFlag path="homeLocation.directions" />
        <TranslatableField<FormValues>
          name="directions"
          label={t("settings.location.directions")}
          multiline
        />
      </div>
      <div className="flex flex-col gap-2">
        <PlaceholderFlag path="homeLocation.distances" />
        <ListEditor
          legend={t("settings.location.distances")}
          description={t("settings.location.distancesHint")}
          ids={distances.fields.map((field) => field.id)}
          itemLabel={distanceLabel}
          renderItem={(index) => (
            <>
              <TranslatableField<FormValues>
                name={`distances.${index}.place`}
                label={t("settings.location.place")}
              />
              <TextField<FormValues>
                name={`distances.${index}.minutes`}
                label={t("settings.location.minutes")}
                inputMode="numeric"
                autoComplete="off"
                className="w-32"
              />
            </>
          )}
          onMove={distances.move}
          onRemove={distances.remove}
          onAdd={() => distances.append({ place: { az: "", en: "", ru: "" }, minutes: "" })}
          addLabel={t("settings.location.addDistance")}
          emptyText={t("settings.location.noDistances")}
          max={20}
          disabled={readOnly}
        />
      </div>
    </SettingsForm>
  );
}
