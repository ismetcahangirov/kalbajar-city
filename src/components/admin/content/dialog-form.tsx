"use client";

import { CircleDashed, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { useFormContext, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";

import { FormAlert } from "@/components/admin/form-alert";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/admin/ui/form";
import { Switch } from "@/components/admin/ui/switch";
import type { Translatable } from "@/i18n/content";
import { t } from "@/lib/admin/messages";
import { missingLocales } from "@/lib/admin/translatables";
import type { PublishStatus } from "@/shared/content";

/** A stored translatable as the form's three inputs, blanks for missing ones. */
export const translatableValues = (value?: Translatable | null) => ({
  az: value?.az ?? "",
  en: value?.en ?? "",
  ru: value?.ru ?? "",
});

/** The editing dialog: a title, scrolling on a short phone screen. */
export function EditDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** The dialog form's message, fields and buttons. */
export function DialogForm<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  onSubmit,
  busy,
  isNew,
  alert,
  onCancel,
  children,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  onSubmit: () => void;
  busy: boolean;
  isNew: boolean;
  alert: string | null;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex min-w-0 flex-col gap-5"
      >
        <FormAlert message={alert} />
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("ui.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {isNew ? t("structure.create") : t("structure.save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** Whether the entry is on the site: a switch over the `status` field. */
export function PublishedField<T extends FieldValues>({
  name,
  disabled,
}: {
  name: Path<T>;
  disabled: boolean;
}) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-4 rounded-md border p-3">
          <div className="flex flex-col gap-1">
            <FormLabel>{t("content.published")}</FormLabel>
            <FormDescription>
              {disabled ? t("content.publishDenied") : t("content.publishedHint")}
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={field.value === "published"}
              disabled={disabled}
              onCheckedChange={(checked) =>
                field.onChange((checked ? "published" : "draft") satisfies PublishStatus)
              }
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/** A draft and missing translations, in words as well as icons. */
export function EntryFlags({
  status,
  texts,
}: {
  status: PublishStatus;
  texts: Array<Translatable | null | undefined>;
}) {
  const missing = [...new Set(texts.flatMap((text) => (text ? missingLocales(text) : [])))];
  if (status === "published" && missing.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {status === "draft" ? (
        <Badge variant="secondary">
          <EyeOff aria-hidden />
          {t("content.hidden")}
        </Badge>
      ) : null}
      {missing.length ? (
        <Badge variant="outline">
          <CircleDashed aria-hidden />
          {t("content.missing", {
            locales: missing.map((locale) => locale.toUpperCase()).join(", "),
          })}
        </Badge>
      ) : null}
    </span>
  );
}
