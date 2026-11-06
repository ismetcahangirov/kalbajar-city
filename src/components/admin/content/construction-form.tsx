"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { TranslatableRichTextField } from "@/components/admin/form/translatable-rich-text-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { FormAlert } from "@/components/admin/form-alert";
import { Form } from "@/components/admin/ui/form";
import { getPathname } from "@/i18n/navigation";
import { defaultLocale } from "@/i18n/routing";
import { t } from "@/lib/admin/messages";
import {
  constructionUpdateFormSchema,
  type AdminConstructionUpdate,
  type ConstructionUpdateForm as FormValues,
} from "@/shared/content";
import { apiErrorOf } from "@/store/errors";
import {
  useAdminConstructionUpdateQuery,
  useCreateConstructionUpdateMutation,
  useDeleteConstructionUpdateMutation,
  usePublishConstructionUpdateMutation,
  useSetConstructionUpdateMediaMutation,
  useUpdateConstructionUpdateMutation,
} from "@/store/endpoints/admin-content";

import {
  ContentAside,
  ContentFormActions,
  richTextValues,
  useDeleteEntry,
} from "./content-form-parts";
import { ConstructionMediaField } from "./construction-media-field";
import { contentPages } from "./content-nav";
import { translatableValues } from "./dialog-form";

const base = contentPages.construction.href;

function valuesOf(item: AdminConstructionUpdate | undefined): FormValues {
  return {
    month: item?.month.slice(0, 7) ?? "",
    title: translatableValues(item?.title),
    body: richTextValues(item?.body),
    progressPercent: item ? String(item.progressPercent) : "",
    mediaIds: item?.mediaIds ?? [],
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

export type ConstructionAbilities = {
  update: boolean;
  delete: boolean;
  publish: boolean;
  upload: boolean;
  /** May change a video's poster, which belongs to the file in the library. */
  updateMedia: boolean;
};

/**
 * A month's construction update (#25): title and text in three languages, the
 * progress, photos and video in display order, and its publication. Like an
 * article, a new update is created as a draft first. The slug is left to the
 * server: `/tikinti` is one page, so no address shows it.
 */
export function ConstructionForm({
  item,
  abilities,
}: {
  item?: AdminConstructionUpdate;
  abilities: ConstructionAbilities;
}) {
  const router = useRouter();
  const [create, { isLoading: creating }] = useCreateConstructionUpdateMutation();
  const [update, { isLoading: updating }] = useUpdateConstructionUpdateMutation();
  const [setMedia, { isLoading: settingMedia }] = useSetConstructionUpdateMediaMutation();
  const [remove, { isLoading: removing }] = useDeleteConstructionUpdateMutation();
  const [publish, { isLoading: publishing }] = usePublishConstructionUpdateMutation();
  const [alert, setAlert] = useState<string | null>(null);
  // The server rendered `item`; publishing changes it, so the panel follows the query.
  const { data: fresh } = useAdminConstructionUpdateQuery(item?.id ?? "", { skip: !item });
  const current = fresh?.id === item?.id ? fresh : item;
  const form = useAdminForm(constructionUpdateFormSchema, { defaultValues: valuesOf(item) });
  const saving = creating || updating || settingMedia;
  const busy = saving || removing || publishing;
  const readOnly = !abilities.update;
  // As in the news form: a failed save does not reset, so this alone is enough.
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) {
        const { mediaIds, ...fields } = values;
        let saved = await update({ id: item.id, ...fields }).unwrap();
        // The text and the media are two endpoints. If this second one fails,
        // the form stays unsaved, and saving again repeats both harmlessly.
        if (!sameList(saved.mediaIds, mediaIds)) {
          saved = await setMedia({ id: item.id, mediaIds }).unwrap();
        }
        form.reset(valuesOf(saved));
        toast.success(t("content.saved"));
      } else {
        const created = await create(values).unwrap();
        form.reset(valuesOf(created));
        toast.success(t("construction.created"));
        router.push(`${base}/${created.id}`);
      }
    } catch (error) {
      setAlert(applyApiErrors(form, error));
      // The API says this field's one failure in English; the editor needs to know which it was.
      if (apiErrorOf(error)?.fields?.month) {
        form.setError("month", { type: "server", message: "construction.monthTaken" });
      }
    }
  });

  const onDelete = useDeleteEntry({
    texts: {
      title: t("construction.deleteTitle"),
      lead: t("construction.deleteLead"),
      confirm: t("construction.delete"),
      done: t("construction.deleted"),
    },
    remove: () => remove(item?.id ?? "").unwrap(),
    listHref: base,
    onDeleted: () => form.reset(form.getValues()),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <Form {...form}>
        <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
          <FormAlert message={alert} />
          <fieldset disabled={readOnly || busy} className="flex min-w-0 flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField<FormValues>
                name="month"
                label={t("construction.month")}
                description={t("construction.monthHint")}
                type="month"
                placeholder="2026-09"
              />
              <TextField<FormValues>
                name="progressPercent"
                label={t("construction.progress")}
                description={t("construction.progressHint")}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
              />
            </div>
            <TranslatableField<FormValues> name="title" label={t("content.fieldTitle")} />
            <TranslatableRichTextField<FormValues>
              name="body"
              label={t("content.body")}
              canUpload={abilities.upload}
              disabled={readOnly || busy}
            />
            <ConstructionMediaField
              disabled={readOnly || busy}
              canUpload={abilities.upload}
              canEditPoster={abilities.updateMedia}
            />
          </fieldset>
          {readOnly ? null : (
            <ContentFormActions
              exists={Boolean(item)}
              saving={saving}
              busy={busy}
              deleteLabel={t("construction.delete")}
              onDelete={abilities.delete ? () => void onDelete() : undefined}
            />
          )}
        </form>
      </Form>

      {current ? (
        <ContentAside
          entry={current}
          canPublish={abilities.publish}
          dirty={dirty}
          busy={busy}
          publicHref={getPathname({ href: "/tikinti", locale: defaultLocale })}
          onChange={async (change) => {
            try {
              await publish({ id: current.id, ...change }).unwrap();
              return true;
            } catch (error) {
              toast.error(applyApiErrors(form, error));
              return false;
            }
          }}
        />
      ) : null}
    </div>
  );
}
