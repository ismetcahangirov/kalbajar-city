"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import { DialogForm, EditDialog } from "@/components/admin/content/dialog-form";
import { DataTable, type ListResult } from "@/components/admin/data-table/data-table";
import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { MediaField } from "@/components/admin/settings/media-field";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/admin/ui/form";
import { Switch } from "@/components/admin/ui/switch";
import { locales } from "@/i18n/routing";
import { adminDateTime } from "@/lib/admin/format";
import { t } from "@/lib/admin/messages";
import {
  normalizeOverridePath,
  seoOverrideCreateSchema,
  type AdminSeoOverride,
  type SeoOverrideCreate,
  type SeoPage,
  type SeoTexts,
} from "@/shared/seo-overrides";
import {
  useAdminSeoOverridesQuery,
  useAdminSeoPagesQuery,
  useCreateSeoOverrideMutation,
  useDeleteSeoOverrideMutation,
  useUpdateSeoOverrideMutation,
} from "@/store/endpoints/admin-seo";

import { LengthHints, SeoPreview } from "./seo-preview";

const pagesListId = "seo-pages";

/** The overrides are few and unpaginated; the table shows them as one page. */
function useOverrideList(): ListResult<AdminSeoOverride> {
  const result = useAdminSeoOverridesQuery();
  const items = result.data;
  return {
    ...result,
    data: items && {
      items,
      page: 1,
      pageSize: Math.max(items.length, 1),
      total: items.length,
      pageCount: 1,
    },
  };
}

/** The languages an override has any text in. */
function overriddenLocales(item: AdminSeoOverride): string[] {
  return locales
    .filter((locale) => item.title[locale] || item.description[locale])
    .map((locale) => locale.toUpperCase());
}

type Editing = { item?: AdminSeoOverride } | null;

/**
 * The console's SEO overrides (#27): per page, a title, description and share
 * image in az, en and ru, and noindex. The form previews the search result and
 * warns, in words, when a text is longer than a result shows.
 */
export function SeoManager({
  canEdit,
  canUpload,
  origin,
}: {
  canEdit: boolean;
  canUpload: boolean;
  origin: string;
}) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing>(null);
  const [remove] = useDeleteSeoOverrideMutation();
  const { data: pages } = useAdminSeoPagesQuery();
  const labels = useMemo(
    () => new Map((pages ?? []).map((page) => [page.path, page.label])),
    [pages],
  );

  const columns = useMemo<ColumnDef<AdminSeoOverride>[]>(() => {
    const onDelete = async (item: AdminSeoOverride) => {
      const confirmed = await confirm({
        title: t("seo.deleteTitle", { path: item.path }),
        description: t("seo.deleteLead"),
        confirmLabel: t("seo.delete"),
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await remove(item.id).unwrap();
        toast.success(t("seo.deleted"));
      } catch (error) {
        toastApiError(error);
      }
    };

    const base: ColumnDef<AdminSeoOverride>[] = [
      {
        id: "path",
        meta: { label: t("seo.path"), primary: true },
        cell: ({ row }) => (
          <span className="flex flex-col items-start">
            <span className="break-all">{row.original.path}</span>
            {labels.get(row.original.path) ? (
              <span className="text-sm text-muted-foreground">{labels.get(row.original.path)}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "overrides",
        meta: { label: t("seo.overrides") },
        cell: ({ row }) => {
          const languages = overriddenLocales(row.original);
          return (
            <span className="flex flex-wrap gap-1">
              {languages.length ? (
                <Badge variant="outline">
                  {t("seo.languages", { locales: languages.join(", ") })}
                </Badge>
              ) : null}
              {row.original.noindex ? (
                <Badge variant="secondary">
                  <EyeOff aria-hidden />
                  {t("seo.noindexBadge")}
                </Badge>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "updated",
        meta: { label: t("seo.updated") },
        cell: ({ row }) => adminDateTime(row.original.updatedAt),
      },
    ];
    if (!canEdit) return base;
    return [
      ...base,
      {
        id: "actions",
        meta: { label: t("seo.actions"), align: "end" },
        cell: ({ row }) => (
          <span className="inline-flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("seo.editLabel", { path: row.original.path })}
              onClick={() => setEditing({ item: row.original })}
            >
              <Pencil aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("seo.deleteLabel", { path: row.original.path })}
              onClick={() => void onDelete(row.original)}
            >
              <Trash2 aria-hidden />
            </Button>
          </span>
        ),
      },
    ];
  }, [canEdit, confirm, remove, labels]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {canEdit ? (
        <div>
          <Button type="button" onClick={() => setEditing({})}>
            <Plus aria-hidden />
            {t("seo.new")}
          </Button>
        </div>
      ) : null}
      <DataTable<AdminSeoOverride, void>
        caption={t("seo.caption")}
        columns={columns}
        defaultSort="path"
        useList={useOverrideList}
        toParams={() => undefined}
        getRowId={(item) => item.id}
      />
      <datalist id={pagesListId}>
        {(pages ?? []).map((page) => (
          <option key={page.path} value={page.path}>
            {page.label}
          </option>
        ))}
      </datalist>
      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.item ? t("seo.edit") : t("seo.new")}
      >
        {editing ? (
          <SeoForm
            item={editing.item}
            pages={pages ?? []}
            origin={origin}
            canUpload={canUpload}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </EditDialog>
    </div>
  );
}

const blankTexts = (): SeoTexts => ({ az: "", en: "", ru: "" });

function SeoForm({
  item,
  pages,
  origin,
  canUpload,
  onDone,
}: {
  item?: AdminSeoOverride;
  pages: SeoPage[];
  origin: string;
  canUpload: boolean;
  onDone: () => void;
}) {
  const [create, created] = useCreateSeoOverrideMutation();
  const [update, updated] = useUpdateSeoOverrideMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(seoOverrideCreateSchema, {
    defaultValues: {
      path: item?.path ?? "",
      title: item?.title ?? blankTexts(),
      description: item?.description ?? blankTexts(),
      ogMediaId: item?.ogMediaId ?? null,
      noindex: item?.noindex ?? false,
    },
  });
  const [path, title, description] = useWatch({
    control: form.control,
    name: ["path", "title", "description"],
  });
  const titles = { ...blankTexts(), ...title } as SeoTexts;
  const descriptions = { ...blankTexts(), ...description } as SeoTexts;
  const typed = normalizeOverridePath(path ?? "");
  const unknown =
    pages.length > 0 && typed.startsWith("/") && !pages.some((page) => page.path === typed);

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) await update({ id: item.id, ...values }).unwrap();
      else await create(values).unwrap();
      toast.success(item ? t("seo.saved") : t("seo.created"));
      onDone();
    } catch (failure) {
      setAlert(applyApiErrors(form, failure));
    }
  });

  return (
    <DialogForm
      form={form}
      onSubmit={() => void onSubmit()}
      busy={created.isLoading || updated.isLoading}
      isNew={!item}
      alert={alert}
      onCancel={onDone}
    >
      <TextField<SeoOverrideCreate>
        name="path"
        label={t("seo.path")}
        description={unknown ? `${t("seo.pathHint")} ${t("seo.pathUnknown")}` : t("seo.pathHint")}
        list={pagesListId}
        autoComplete="off"
        spellCheck={false}
      />
      <TranslatableField<SeoOverrideCreate> name="title" label={t("seo.title")} />
      <LengthHints texts={titles} field="title" />
      <TranslatableField<SeoOverrideCreate>
        name="description"
        label={t("seo.description")}
        multiline
      />
      <LengthHints texts={descriptions} field="description" />
      <SeoPreview origin={origin} path={typed} title={titles} description={descriptions} />
      <FormField
        control={form.control}
        name="ogMediaId"
        render={({ field }) => (
          <MediaField
            label={t("seo.ogImage")}
            description={t("seo.ogImageHint")}
            value={field.value ?? null}
            onChange={field.onChange}
            canUpload={canUpload}
          />
        )}
      />
      <FormField
        control={form.control}
        name="noindex"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between gap-4 rounded-md border p-3">
            <div className="flex flex-col gap-1">
              <FormLabel>{t("seo.noindex")}</FormLabel>
              <FormDescription>{t("seo.noindexHint")}</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </DialogForm>
  );
}
