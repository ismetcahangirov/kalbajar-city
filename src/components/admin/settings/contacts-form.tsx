"use client";

import { ExternalLink } from "lucide-react";
import { useFieldArray, useWatch } from "react-hook-form";

import { TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { useAdminForm } from "@/components/admin/form/use-admin-form";
import { t } from "@/lib/admin/messages";
import {
  contactsFormSchema,
  contactsToForm,
  type ContactsForm as FormValues,
} from "@/lib/admin/settings-forms";
import type { SettingsValue } from "@/shared/settings";
import { useUpdateSettingMutation } from "@/store/endpoints/admin-settings";

import { ListEditor } from "./list-editor";
import { PlaceholderFlag } from "./placeholders";
import { SettingsForm } from "./settings-form";

type Contacts = SettingsValue<"contacts">;

/** Coordinates as a map link, so the editor can check them; null until both read as numbers. */
function mapHref(lat: unknown, lng: unknown): string | null {
  const read = (value: unknown) =>
    Number(
      String(value ?? "")
        .trim()
        .replace(",", "."),
    );
  const [y, x] = [read(lat), read(lng)];
  if (!String(lat ?? "").trim() || !String(lng ?? "").trim()) return null;
  if (!Number.isFinite(y) || !Number.isFinite(x) || Math.abs(y) > 90 || Math.abs(x) > 180) {
    return null;
  }
  return `https://www.openstreetmap.org/?mlat=${y}&mlon=${x}#map=15/${y}/${x}`;
}

/** Phones, WhatsApp, e-mail, address, office hours and the map's coordinates. */
export function ContactsForm({ initial, readOnly }: { initial: Contacts; readOnly: boolean }) {
  const [save] = useUpdateSettingMutation();
  const form = useAdminForm(contactsFormSchema, { defaultValues: contactsToForm(initial) });
  const phones = useFieldArray({ control: form.control, name: "phones" });
  const [lat, lng] = useWatch({
    control: form.control,
    name: ["coordinates.lat", "coordinates.lng"],
  });
  const map = mapHref(lat, lng);

  return (
    <SettingsForm
      form={form}
      readOnly={readOnly}
      onSave={async (value) => {
        const saved = await save({ key: "contacts", value }).unwrap();
        return contactsToForm(saved.value as Contacts);
      }}
    >
      <ListEditor
        legend={t("settings.contacts.phones")}
        description={t("settings.contacts.phonesHint")}
        ids={phones.fields.map((field) => field.id)}
        itemLabel={(index) =>
          index === 0
            ? t("settings.contacts.mainPhone")
            : t("settings.contacts.phone", { index: index + 1 })
        }
        renderItem={(index) => (
          <TextField<FormValues>
            name={`phones.${index}.number`}
            label={t("settings.contacts.phoneNumber")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
          />
        )}
        onMove={phones.move}
        onRemove={phones.remove}
        onAdd={() => phones.append({ number: "" })}
        addLabel={t("settings.contacts.addPhone")}
        emptyText={t("settings.contacts.noPhones")}
        min={1}
        max={10}
        disabled={readOnly}
      />

      <TextField<FormValues>
        name="whatsapp"
        label={t("settings.contacts.whatsapp")}
        description={t("settings.contacts.whatsappHint")}
        type="tel"
        inputMode="tel"
        autoComplete="off"
      />

      <div className="flex flex-col gap-2">
        <PlaceholderFlag path="contacts.email" />
        <TextField<FormValues>
          name="email"
          label={t("settings.contacts.email")}
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-col gap-2">
        <PlaceholderFlag path="contacts.address" />
        <TranslatableField<FormValues> name="address" label={t("settings.contacts.address")} />
      </div>

      <div className="flex flex-col gap-2">
        <PlaceholderFlag path="contacts.hours" />
        <TranslatableField<FormValues> name="hours" label={t("settings.contacts.hours")} />
      </div>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm mb-2 font-medium">{t("settings.contacts.coordinates")}</legend>
        <PlaceholderFlag path="contacts.coordinates" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField<FormValues>
            name="coordinates.lat"
            label={t("settings.contacts.lat")}
            inputMode="decimal"
            autoComplete="off"
          />
          <TextField<FormValues>
            name="coordinates.lng"
            label={t("settings.contacts.lng")}
            inputMode="decimal"
            autoComplete="off"
          />
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.contacts.coordinatesHint")}</p>
        {map ? (
          <a
            href={map}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm inline-flex min-h-(--spacing-target) items-center gap-1 self-start font-medium underline underline-offset-4"
          >
            {t("settings.contacts.openMap")}
            <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">{t("ui.newTab")}</span>
          </a>
        ) : null}
      </fieldset>
    </SettingsForm>
  );
}
