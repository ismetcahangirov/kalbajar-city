"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { TranslatableRichTextField } from "@/components/admin/form/translatable-rich-text-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { FormAlert } from "@/components/admin/form-alert";
import { MediaField } from "@/components/admin/settings/media-field";
import { Button } from "@/components/admin/ui/button";
import { Form } from "@/components/admin/ui/form";
import { t } from "@/lib/admin/messages";
import { newsFormSchema, type AdminNews, type NewsForm as NewsFormValues } from "@/shared/content";
import type { RichTextDoc } from "@/shared/rich-text";
import {
  useCreateNewsMutation,
  useDeleteNewsMutation,
  useAdminNewsQuery,
  usePublishNewsMutation,
  useUpdateNewsMutation,
} from "@/store/endpoints/admin-content";

import { contentPages } from "./content-nav";
import { PublicationPanel } from "./publication-panel";

const base = contentPages.news.href;

const emptyDoc: RichTextDoc = { type: "doc", content: [{ type: "paragraph" }] };

function valuesOf(item: AdminNews | undefined): NewsFormValues {
  return {
    slug: item?.slug ?? "",
    title: { az: item?.title.az ?? "", en: item?.title.en ?? "", ru: item?.title.ru ?? "" },
    excerpt: {
      az: item?.excerpt?.az ?? "",
      en: item?.excerpt?.en ?? "",
      ru: item?.excerpt?.ru ?? "",
    },
    body: {
      az: item?.body.az ?? emptyDoc,
      en: item?.body.en ?? emptyDoc,
      ru: item?.body.ru ?? emptyDoc,
    },
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
  const confirm = useConfirm();
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
  const dirty = form.formState.isDirty && !form.formState.isSubmitSuccessful;
  useUnsavedChangesGuard(dirty);

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) {
        const saved = await update({ id: item.id, ...values }).unwrap();
        form.reset(valuesOf(saved));
        toast.success(t("news.saved"));
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

  const onDelete = async () => {
    if (!item) return;
    const confirmed = await confirm({
      title: t("news.deleteTitle"),
      description: t("news.deleteLead"),
      confirmLabel: t("news.delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(item.id).unwrap();
      form.reset(form.getValues());
      toast.success(t("news.deleted"));
      router.push(base);
    } catch (error) {
      toastApiError(error);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <Form {...form}>
        <form noValidate onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
          <FormAlert message={alert} />
          <fieldset disabled={readOnly || busy} className="flex min-w-0 flex-col gap-6">
            <TranslatableField<NewsFormValues> name="title" label={t("news.fieldTitle")} />
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
              label={t("news.body")}
              canUpload={abilities.upload}
              disabled={readOnly || busy}
            />
          </fieldset>
          {readOnly ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy}>
                {item
                  ? updating
                    ? t("news.saving")
                    : t("news.save")
                  : creating
                    ? t("news.creating")
                    : t("news.create")}
              </Button>
              {item && abilities.delete ? (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive ml-auto"
                  disabled={busy}
                  onClick={() => void onDelete()}
                >
                  <Trash2 aria-hidden />
                  {t("news.delete")}
                </Button>
              ) : null}
            </div>
          )}
        </form>
      </Form>

      {current ? (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <PublicationPanel
            entry={current}
            canPublish={abilities.publish}
            dirty={dirty}
            busy={busy}
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
          {current.state === "published" ? (
            <Button asChild variant="outline" className="self-start">
              <a href={`/xeberler/${current.slug}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden />
                {t("news.view")}
              </a>
            </Button>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
