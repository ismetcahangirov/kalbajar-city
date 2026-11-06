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
import { MediaField } from "@/components/admin/settings/media-field";
import { Form } from "@/components/admin/ui/form";
import { getPathname } from "@/i18n/navigation";
import { defaultLocale } from "@/i18n/routing";
import { t } from "@/lib/admin/messages";
import { newsFormSchema, type AdminNews, type NewsForm as NewsFormValues } from "@/shared/content";
import {
  useCreateNewsMutation,
  useDeleteNewsMutation,
  useAdminNewsQuery,
  usePublishNewsMutation,
  useUpdateNewsMutation,
} from "@/store/endpoints/admin-content";

import {
  ContentAside,
  ContentFormActions,
  richTextValues,
  useDeleteEntry,
} from "./content-form-parts";
import { contentPages } from "./content-nav";

const base = contentPages.news.href;

function valuesOf(item: AdminNews | undefined): NewsFormValues {
  return {
    slug: item?.slug ?? "",
    title: { az: item?.title.az ?? "", en: item?.title.en ?? "", ru: item?.title.ru ?? "" },
    excerpt: {
      az: item?.excerpt?.az ?? "",
      en: item?.excerpt?.en ?? "",
      ru: item?.excerpt?.ru ?? "",
    },
    body: richTextValues(item?.body),
    coverMediaId: item?.coverMediaId ?? null,
  };
}

export type NewsAbilities = {
  update: boolean;
  delete: boolean;
  publish: boolean;
  upload: boolean;
};

/**
 * An article (#25): title, slug, excerpt and body in three languages, a cover
 * from the media library, and its publication: publish now, schedule, or
 * withdraw. A new article is created as a draft first.
 */
export function NewsForm({ item, abilities }: { item?: AdminNews; abilities: NewsAbilities }) {
  const router = useRouter();
  const [create, { isLoading: creating }] = useCreateNewsMutation();
  const [update, { isLoading: updating }] = useUpdateNewsMutation();
  const [remove, { isLoading: removing }] = useDeleteNewsMutation();
  const [publish, { isLoading: publishing }] = usePublishNewsMutation();
  const [alert, setAlert] = useState<string | null>(null);
  // The server rendered `item`; publishing changes it, so the panel follows the query.
  const { data: fresh } = useAdminNewsQuery(item?.id ?? "", { skip: !item });
  const current = fresh?.id === item?.id ? fresh : item;
  const form = useAdminForm(newsFormSchema, { defaultValues: valuesOf(item) });
  const coverMediaId = form.watch("coverMediaId");
  const busy = creating || updating || removing || publishing;
  const readOnly = !abilities.update;
  // A successful save resets the form to what was saved; a failed one does not,
  // so `isDirty` alone says whether anything is unsaved. (`isSubmitSuccessful`
  // stays true after a save until the next submit, and is true when a save the
  // handler caught failed, so it cannot be part of this.)
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) {
        const saved = await update({ id: item.id, ...values }).unwrap();
        form.reset(valuesOf(saved));
        toast.success(t("content.saved"));
      } else {
        const created = await create(values).unwrap();
        form.reset(valuesOf(created));
        toast.success(t("news.created"));
        router.push(`${base}/${created.id}`);
      }
    } catch (error) {
      setAlert(applyApiErrors(form, error));
    }
  });

  const onDelete = useDeleteEntry({
    texts: {
      title: t("news.deleteTitle"),
      lead: t("news.deleteLead"),
      confirm: t("news.delete"),
      done: t("news.deleted"),
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
            <TranslatableField<NewsFormValues> name="title" label={t("content.fieldTitle")} />
            <TextField<NewsFormValues>
              name="slug"
              label={t("news.slug")}
              description={t("news.slugHint")}
              autoComplete="off"
            />
            <TranslatableField<NewsFormValues> name="excerpt" label={t("news.excerpt")} multiline />
            <p className="text-sm text-muted-foreground -mt-4">{t("news.excerptHint")}</p>
            <MediaField
              label={t("news.cover")}
              description={t("news.coverHint")}
              value={coverMediaId}
              disabled={readOnly || busy}
              canUpload={abilities.upload}
              onChange={(id) =>
                form.setValue("coverMediaId", id, { shouldDirty: true, shouldValidate: true })
              }
            />
            <TranslatableRichTextField<NewsFormValues>
              name="body"
              label={t("content.body")}
              canUpload={abilities.upload}
              disabled={readOnly || busy}
            />
          </fieldset>
          {readOnly ? null : (
            <ContentFormActions
              exists={Boolean(item)}
              saving={creating || updating}
              busy={busy}
              deleteLabel={t("news.delete")}
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
          publicHref={getPathname({
            href: { pathname: "/xeberler/[slug]", params: { slug: current.slug } },
            locale: defaultLocale,
          })}
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
