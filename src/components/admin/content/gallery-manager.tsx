"use client";

import { ImageIcon, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { SelectField, TextField } from "@/components/admin/form/fields";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { MediaField } from "@/components/admin/settings/media-field";
import { SortableList } from "@/components/admin/sortable/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import {
  galleryCategoryCreateSchema,
  galleryItemFormSchema,
  type AdminGalleryCategory,
  type AdminGalleryItem,
  type GalleryCategoryCreate,
  type GalleryItemForm,
} from "@/shared/gallery";
import {
  useAdminGalleryQuery,
  useCreateGalleryCategoryMutation,
  useCreateGalleryItemMutation,
  useDeleteGalleryCategoryMutation,
  useDeleteGalleryItemMutation,
  useReorderGalleryCategoriesMutation,
  useReorderGalleryItemsMutation,
  useUpdateGalleryCategoryMutation,
  useUpdateGalleryItemMutation,
} from "@/store/endpoints/admin-faq-gallery";

import {
  DialogForm,
  EditDialog,
  EntryFlags,
  PublishedField,
  translatableValues,
} from "./dialog-form";
import type { ContentAbilities } from "./faq-manager";

type Abilities = ContentAbilities & { upload: boolean };

type Editing =
  | { kind: "category"; item?: AdminGalleryCategory }
  | { kind: "item"; item: AdminGalleryItem }
  | null;

/** An item's name in buttons and announcements: its caption, else the file's alt text. */
const itemName = (item: AdminGalleryItem) =>
  item.caption?.az || item.media.alt || t("picker.untitled");

function Thumb({ item }: { item: AdminGalleryItem }) {
  return item.media.previewUrl ? (
    // The console shows library previews as they are; the public site's
    // <Picture> handles responsive images.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.media.previewUrl}
      alt=""
      className="bg-muted size-16 shrink-0 rounded-md object-cover"
    />
  ) : (
    <span className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-md">
      <ImageIcon aria-hidden />
    </span>
  );
}

/**
 * The gallery (#25): categories and their images, each list in the order of
 * `/qalereya`. Images come from the media library. Videos are not offered:
 * whether they belong in the gallery is still open on #25.
 */
export function GalleryManager({ abilities }: { abilities: Abilities }) {
  const { data, isLoading, isError, error, refetch } = useAdminGalleryQuery();
  const [reorderCategories] = useReorderGalleryCategoriesMutation();
  const [reorderItems] = useReorderGalleryItemsMutation();
  const [deleteCategory] = useDeleteGalleryCategoryMutation();
  const [deleteItem] = useDeleteGalleryItemMutation();
  const [createItem] = useCreateGalleryItemMutation();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Editing>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const categorySelectId = useId();

  const categories = data?.categories ?? [];
  const current = categories.find((category) => category.id === selected) ?? categories[0] ?? null;

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action();
      if (success) toast.success(success);
    } catch (failure) {
      toastApiError(failure);
    }
  };

  const onDeleteCategory = async (category: AdminGalleryCategory) => {
    const confirmed = await confirm({
      title: t("structure.deleteTitle", { name: category.name.az }),
      description: category.items.length
        ? t("gallery.deleteCategoryItems", { count: category.items.length })
        : t("structure.deleteLead"),
      confirmLabel: t("structure.delete", { name: category.name.az }),
      destructive: true,
    });
    if (confirmed) {
      await run(() => deleteCategory(category.id).unwrap(), t("structure.deleted"));
    }
  };

  const onDeleteItem = async (item: AdminGalleryItem) => {
    const confirmed = await confirm({
      title: t("gallery.deleteItemTitle"),
      description: t("gallery.deleteItemLead"),
      confirmLabel: t("structure.delete", { name: itemName(item) }),
      destructive: true,
    });
    if (confirmed) await run(() => deleteItem(item.id).unwrap(), t("structure.deleted"));
  };

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-destructive">{apiErrorMessage(error)}</p>
        <Button type="button" variant="outline" onClick={() => refetch()}>
          {t("ui.retry")}
        </Button>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="gallery-categories" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gallery-categories" className="text-lg font-medium">
            {t("gallery.categories")}
          </h2>
          {abilities.create ? (
            <Button type="button" onClick={() => setEditing({ kind: "category" })}>
              <Plus aria-hidden />
              {t("gallery.newCategory")}
            </Button>
          ) : null}
        </div>
        {categories.length ? (
          <SortableList
            items={categories}
            label={t("gallery.categories")}
            itemName={(category) => category.name.az}
            disabled={!abilities.update}
            onReorder={(ids) => void run(() => reorderCategories(ids).unwrap())}
            renderItem={(category) => (
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="font-medium break-words">{category.name.az}</h3>
                  <p className="text-sm text-muted-foreground break-all">
                    ?kateqoriya={category.slug}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("gallery.itemCount", { count: category.items.length })}
                  </p>
                  <EntryFlags status="published" texts={[category.name]} />
                </div>
                <span className="flex shrink-0 gap-1">
                  {abilities.update ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("structure.edit", { name: category.name.az })}
                      onClick={() => setEditing({ kind: "category", item: category })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  ) : null}
                  {abilities.delete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("structure.delete", { name: category.name.az })}
                      onClick={() => void onDeleteCategory(category)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  ) : null}
                </span>
              </div>
            )}
          />
        ) : (
          <p className="rounded-md border border-dashed p-6">{t("gallery.noCategories")}</p>
        )}
      </section>

      <section aria-labelledby="gallery-items" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gallery-items" className="text-lg font-medium">
            {t("gallery.items")}
          </h2>
          {abilities.create && current ? (
            <Button type="button" onClick={() => setPicking(true)}>
              <ImagePlus aria-hidden />
              {t("gallery.addImage")}
            </Button>
          ) : null}
        </div>
        {current ? (
          <>
            <div className="flex max-w-sm flex-col gap-2">
              <Label htmlFor={categorySelectId}>{t("gallery.category")}</Label>
              <Select value={current.id} onValueChange={setSelected}>
                <SelectTrigger id={categorySelectId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name.az}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{t("gallery.imagesOnly")}</p>
            {current.items.length ? (
              <SortableList
                items={current.items}
                label={t("gallery.itemsOf", { name: current.name.az })}
                itemName={itemName}
                disabled={!abilities.update}
                onReorder={(ids) =>
                  void run(() => reorderItems({ categoryId: current.id, ids }).unwrap())
                }
                renderItem={(item) => (
                  <div className="flex min-w-0 items-start gap-3">
                    <Thumb item={item} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="font-medium break-words">{itemName(item)}</p>
                      {item.media.missingAlt ? (
                        <p className="text-sm text-destructive">{t("gallery.missingAlt")}</p>
                      ) : null}
                      <EntryFlags status={item.status} texts={item.caption ? [item.caption] : []} />
                    </div>
                    <span className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      {abilities.update ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("structure.edit", { name: itemName(item) })}
                          onClick={() => setEditing({ kind: "item", item })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      ) : null}
                      {abilities.delete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("structure.delete", { name: itemName(item) })}
                          onClick={() => void onDeleteItem(item)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </span>
                  </div>
                )}
              />
            ) : (
              <p className="rounded-md border border-dashed p-6">{t("gallery.noItems")}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("gallery.categoryFirst")}</p>
        )}
      </section>

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        kind="image"
        title={t("gallery.addImage")}
        canUpload={abilities.upload}
        exclude={current?.items.map((item) => item.mediaId) ?? []}
        onSelect={(file) => {
          if (!current) return;
          void run(async () => {
            await createItem({
              categoryId: current.id,
              mediaId: file.id,
              status: abilities.publish ? "published" : "draft",
            }).unwrap();
            if (file.missingAlt) toast.warning(t("gallery.missingAlt"));
          }, t("gallery.added"));
        }}
      />

      <EditDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing?.kind === "item"
            ? t("gallery.editItem")
            : editing?.item
              ? t("gallery.editCategory")
              : t("gallery.newCategory")
        }
      >
        {editing?.kind === "category" ? (
          <CategoryForm item={editing.item} onDone={() => setEditing(null)} />
        ) : editing?.kind === "item" ? (
          <ItemForm
            item={editing.item}
            categories={categories}
            abilities={abilities}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </EditDialog>
    </div>
  );
}

function CategoryForm({ item, onDone }: { item?: AdminGalleryCategory; onDone: () => void }) {
  const [create, created] = useCreateGalleryCategoryMutation();
  const [update, updated] = useUpdateGalleryCategoryMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(galleryCategoryCreateSchema, {
    defaultValues: { name: translatableValues(item?.name), slug: item?.slug ?? "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      if (item) await update({ id: item.id, ...values }).unwrap();
      else await create(values).unwrap();
      toast.success(t("structure.saved"));
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
      <TranslatableField<GalleryCategoryCreate> name="name" label={t("structure.name")} />
      <TextField<GalleryCategoryCreate>
        name="slug"
        label={t("gallery.slug")}
        description={t("gallery.slugHint")}
        autoComplete="off"
      />
    </DialogForm>
  );
}

function ItemForm({
  item,
  categories,
  abilities,
  onDone,
}: {
  item: AdminGalleryItem;
  categories: AdminGalleryCategory[];
  abilities: Abilities;
  onDone: () => void;
}) {
  const [update, updated] = useUpdateGalleryItemMutation();
  const [alert, setAlert] = useState<string | null>(null);
  const form = useAdminForm(galleryItemFormSchema, {
    defaultValues: {
      categoryId: item.categoryId,
      mediaId: item.mediaId,
      caption: translatableValues(item.caption),
      status: item.status,
    },
  });
  const mediaId = form.watch("mediaId");

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      await update({ id: item.id, ...values }).unwrap();
      toast.success(t("structure.saved"));
      onDone();
    } catch (failure) {
      setAlert(applyApiErrors(form, failure));
    }
  });

  return (
    <DialogForm
      form={form}
      onSubmit={() => void onSubmit()}
      busy={updated.isLoading}
      isNew={false}
      alert={alert}
      onCancel={onDone}
    >
      <MediaField
        label={t("gallery.image")}
        value={mediaId}
        canUpload={abilities.upload}
        onChange={(id) => {
          if (id) form.setValue("mediaId", id, { shouldDirty: true });
        }}
      />
      <TranslatableField<GalleryItemForm> name="caption" label={t("gallery.caption")} />
      <p className="text-sm text-muted-foreground">{t("gallery.captionHint")}</p>
      <SelectField<GalleryItemForm>
        name="categoryId"
        label={t("gallery.category")}
        description={t("gallery.moveHint")}
        options={categories.map((category) => ({ value: category.id, label: category.name.az }))}
      />
      <PublishedField<GalleryItemForm> name="status" disabled={!abilities.publish} />
    </DialogForm>
  );
}
