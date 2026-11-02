"use client";

import { Camera, ExternalLink, Images, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { z } from "zod";

import { FormAlert } from "@/components/admin/form-alert";
import { TranslatableField } from "@/components/admin/form/translatable-field";
import { applyApiErrors, useAdminForm } from "@/components/admin/form/use-admin-form";
import { useConfirm } from "@/components/admin/feedback/confirm";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { useUnsavedChangesGuard } from "@/components/admin/feedback/unsaved-changes";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/admin/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { adminDateTime, adminNumber } from "@/lib/admin/format";
import {
  describeUsage,
  formatDuration,
  formatFileSize,
  mediaHref,
  mediaItemHref,
} from "@/lib/admin/media-list";
import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import { corsUrl } from "@/lib/admin/video-frame";
import {
  mediaSources,
  type AdminMedia,
  type AdminMediaDetail,
  type MediaUsage,
} from "@/shared/media";
import { apiErrorOf } from "@/store/errors";
import {
  useAdminMediaQuery,
  useDeleteMediaMutation,
  useUpdateMediaMutation,
} from "@/store/endpoints/admin-media";

import { FocusPicker } from "./focus-picker";
import { MediaPicker } from "./media-picker";
import { MediaFlags, mediaName, thumbUrl } from "./media-thumb";
import { useCapturePoster } from "./use-media-uploads";

export type MediaPermissions = { update: boolean; delete: boolean; upload: boolean };

const textMax = 500;

/** One language's text: optional, but `az` must be there when another is. */
const optionalTranslatable = z
  .object({
    az: z.string().trim().max(textMax),
    en: z.string().trim().max(textMax),
    ru: z.string().trim().max(textMax),
  })
  .superRefine((value, ctx) => {
    if (!value.az && (value.en || value.ru)) {
      ctx.addIssue({ code: "custom", path: ["az"], message: "media.azFirst" });
    }
  });

const formSchema = z.object({
  alt: optionalTranslatable,
  caption: optionalTranslatable,
  source: z.enum(mediaSources),
  illustrative: z.boolean(),
  decorative: z.boolean(),
  focusX: z.number().min(0).max(1),
  focusY: z.number().min(0).max(1),
});

type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const texts = (value: AdminMedia["alt"]) => ({
  az: value?.az ?? "",
  en: value?.en ?? "",
  ru: value?.ru ?? "",
});

const fromTexts = (value: FormOutput["alt"]) =>
  value.az ? { az: value.az, en: value.en || null, ru: value.ru || null } : null;

const formValues = (item: AdminMedia): FormInput => ({
  alt: texts(item.alt),
  caption: texts(item.caption),
  source: item.source,
  illustrative: item.illustrative,
  decorative: item.decorative,
  focusX: item.focusX,
  focusY: item.focusY,
});

/**
 * One file of the library (#25): its preview with the focus-point picker (an
 * image) or the poster frame (a video), alt text and caption in three
 * languages, source and flags, where it is used, and delete, which the API
 * refuses while anything uses it.
 */
export function MediaDetail({
  initial,
  permissions,
}: {
  initial: AdminMediaDetail;
  permissions: MediaPermissions;
}) {
  const { data = initial } = useAdminMediaQuery(initial.id, { refetchOnFocus: true });
  const item = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={mediaName(item)}
        description={`${t(`media.kind.${item.kind}`)} · ${adminDateTime(item.createdAt)}`}
      />
      <MediaFlags item={item} />
      {/* Remounted when another file opens, so the form starts from it. */}
      <MediaForm key={item.id} item={item} permissions={permissions} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("media.usages")}>
          <UsageList usages={item.usages} />
        </Section>
        <Section title={t("media.details")}>
          <FileFacts item={item} />
        </Section>
      </div>
      {permissions.delete ? <DeleteCard item={item} /> : null}
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 gap-4 shadow-none", className)}>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function MediaForm({ item, permissions }: { item: AdminMedia; permissions: MediaPermissions }) {
  const [update, { error, reset: resetError }] = useUpdateMediaMutation();
  const form = useAdminForm(formSchema, { defaultValues: formValues(item) });
  useUnsavedChangesGuard(form.formState.isDirty);
  const [source, focusX, focusY] = useWatch({
    control: form.control,
    name: ["source", "focusX", "focusY"],
  });
  const generated = source === "generated";
  const readOnly = !permissions.update;
  const preview = thumbUrl(item);
  // The sharpest WebP up to 1600 px for the picker; the thumbnail is too small.
  const large =
    item.variants
      .filter((variant) => variant.format === "webp" && variant.width <= 1600)
      .sort((a, b) => b.width - a.width)[0]?.url ?? preview;

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        onSubmit={form.handleSubmit(async (values) => {
          resetError();
          try {
            const saved = await update({
              id: item.id,
              alt: fromTexts(values.alt),
              caption: fromTexts(values.caption),
              source: values.source,
              illustrative: values.source === "generated" ? true : values.illustrative,
              decorative: values.decorative,
              focusX: values.focusX,
              focusY: values.focusY,
            }).unwrap();
            form.reset(formValues(saved));
            toast.success(t("media.saved"));
          } catch (cause) {
            applyApiErrors(form, cause);
          }
        })}
      >
        <Section title={item.kind === "image" ? t("media.focus") : t("media.poster")}>
          {item.kind === "image" && large && item.width && item.height ? (
            readOnly ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={large}
                alt={item.alt?.az ?? ""}
                width={item.width}
                height={item.height}
                className="h-auto w-full max-w-xl rounded-md"
              />
            ) : (
              <FocusPicker
                src={large}
                width={item.width}
                height={item.height}
                value={{ x: focusX, y: focusY }}
                onChange={({ x, y }) => {
                  form.setValue("focusX", x, { shouldDirty: true });
                  form.setValue("focusY", y, { shouldDirty: true });
                }}
              />
            )
          ) : item.kind === "video" ? (
            <VideoPoster item={item} permissions={permissions} />
          ) : null}
        </Section>

        <Section title={t("media.texts")}>
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
            <TranslatableField<FormInput> name="alt" label={t("media.alt")} />
            <p className="text-sm text-muted-foreground -mt-4">
              {item.kind === "image" ? t("media.altHint") : t("media.altVideoHint")}
            </p>
            <TranslatableField<FormInput>
              name="caption"
              label={t("media.captionField")}
              multiline
            />

            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("media.source")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-72">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mediaSources.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`media.source.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t("media.sourceHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="illustrative"
              render={({ field }) => (
                <SwitchRow
                  label={t("media.illustrative")}
                  description={
                    generated ? t("media.illustrativeLocked") : t("media.illustrativeHint")
                  }
                  checked={generated || field.value}
                  disabled={readOnly || generated}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            {item.kind === "image" ? (
              <FormField
                control={form.control}
                name="decorative"
                render={({ field }) => (
                  <SwitchRow
                    label={t("media.decorative")}
                    description={t("media.decorativeHint")}
                    checked={field.value}
                    disabled={readOnly}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            ) : null}

            <FormAlert message={error ? apiErrorMessage(error) : null} />
            {readOnly ? null : (
              <Button type="submit" className="self-start" disabled={form.formState.isSubmitting}>
                {t("media.save")}
              </Button>
            )}
          </fieldset>
        </Section>
      </form>
    </Form>
  );
}

/** A labelled switch whose whole row is the target, 44 px tall on touch screens. */
function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <FormItem>
      <div className="flex min-h-(--spacing-target) items-center gap-3">
        <FormControl>
          <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
        </FormControl>
        <FormLabel className="flex-1 cursor-pointer py-2">{label}</FormLabel>
      </div>
      <FormDescription>{description}</FormDescription>
    </FormItem>
  );
}

/**
 * A video's poster: the frame shown until it plays. The editor scrubs the
 * video and captures the frame on screen, or picks an image from the library.
 */
function VideoPoster({ item, permissions }: { item: AdminMedia; permissions: MediaPermissions }) {
  const video = useRef<HTMLVideoElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const capturePoster = useCapturePoster();
  const [update] = useUpdateMediaMutation();
  const canChange = permissions.update && permissions.upload;

  const setPoster = async (posterMediaId: string | null) => {
    setBusy(true);
    setProblem(null);
    try {
      await update({ id: item.id, posterMediaId }).unwrap();
      toast.success(t("media.posterSaved"));
    } catch (error) {
      toastApiError(error);
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!video.current) return;
    setBusy(true);
    setProblem(null);
    try {
      await capturePoster(item, video.current);
      toast.success(t("media.posterSaved"));
    } catch (error) {
      console.warn("media: capturing the poster failed", error);
      setProblem(apiErrorOf(error) ? apiErrorMessage(error) : t("media.posterFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {item.previewUrl ? (
        <video
          ref={video}
          // Loaded with CORS, so the frame on screen can be drawn on a canvas.
          src={corsUrl(item.previewUrl)}
          crossOrigin="anonymous"
          controls
          muted
          playsInline
          preload="auto"
          aria-label={t("media.videoLabel", { name: mediaName(item) })}
          className="bg-muted w-full max-w-xl rounded-md"
          style={
            item.width && item.height
              ? { aspectRatio: `${item.width} / ${item.height}` }
              : undefined
          }
        />
      ) : null}
      <p className="text-sm text-muted-foreground">{t("media.posterHint")}</p>
      <div className="flex flex-wrap items-center gap-3" data-poster={item.poster?.id ?? ""}>
        {item.poster?.previewUrl ? (
          <Link href={mediaItemHref(item.poster.id)} className="flex items-center gap-3 rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.poster.previewUrl}
              alt={t("media.posterAlt")}
              className="h-20 w-auto rounded-sm"
            />
            <span className="text-sm underline underline-offset-4">{t("media.posterOpen")}</span>
          </Link>
        ) : (
          <p className="text-sm">{t("media.posterNone")}</p>
        )}
      </div>
      {canChange ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !item.previewUrl} onClick={capture}>
            <Camera aria-hidden />
            {t("media.posterCapture")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setPickerOpen(true)}
          >
            <Images aria-hidden />
            {t("media.posterPick")}
          </Button>
          {item.poster ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setPoster(null)}>
              <X aria-hidden />
              {t("media.posterRemove")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <FormAlert message={problem} />
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kind="image"
        title={t("media.posterPick")}
        canUpload={permissions.upload}
        exclude={item.poster ? [item.poster.id] : []}
        onSelect={(picked) => void setPoster(picked.id)}
      />
    </div>
  );
}

function UsageList({ usages }: { usages: MediaUsage[] }) {
  if (!usages.length) return <p className="text-sm">{t("media.usagesNone")}</p>;
  return (
    <ul className="text-sm flex flex-col gap-1" data-usages="">
      {usages.map((usage, index) => {
        const { label, href } = describeUsage(usage);
        return (
          <li key={`${usage.entityType}-${usage.entityId}-${usage.field}-${index}`}>
            {href ? (
              <Link
                href={href}
                className="inline-flex min-h-(--spacing-target) items-center gap-1 underline underline-offset-4 md:min-h-0"
              >
                {label}
                <ExternalLink aria-hidden className="size-3" />
              </Link>
            ) : (
              label
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FileFacts({ item }: { item: AdminMedia }) {
  const rows: Array<[string, ReactNode]> = [
    [t("media.file"), mediaName(item)],
    [t("media.kind"), `${t(`media.kind.${item.kind}`)} · ${item.mimeType}`],
    [t("media.size"), formatFileSize(item.size)],
  ];
  if (item.width && item.height) {
    rows.push([
      t("media.dimensions"),
      `${adminNumber(item.width, 0)} × ${adminNumber(item.height, 0)} px`,
    ]);
  }
  if (item.durationMs) rows.push([t("media.duration"), formatDuration(item.durationMs)]);
  if (item.codec) rows.push([t("media.codec"), item.codec]);
  rows.push([t("media.createdAt"), adminDateTime(item.createdAt)]);
  return (
    <dl className="text-sm grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Delete, after a confirmation; a file in use is refused with the places to change first. */
function DeleteCard({ item }: { item: AdminMediaDetail }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [remove, { isLoading }] = useDeleteMediaMutation();
  const [blocked, setBlocked] = useState<MediaUsage[] | null>(null);

  const onDelete = async () => {
    setBlocked(null);
    const confirmed = await confirm({
      title: t("media.deleteTitle"),
      description: t("media.deleteLead"),
      confirmLabel: t("media.delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(item.id).unwrap();
      toast.success(t("media.deleted"));
      router.push(mediaHref);
    } catch (error) {
      const body = apiErrorOf(error) as
        (ReturnType<typeof apiErrorOf> & { usages?: MediaUsage[] }) | null;
      if (body?.code === "MEDIA_IN_USE") setBlocked(body.usages ?? []);
      else toastApiError(error);
    }
  };

  return (
    <Section title={t("media.delete")}>
      <p className="text-sm text-muted-foreground">{t("media.deleteHint")}</p>
      <Button
        type="button"
        variant="destructive"
        className="self-start"
        disabled={isLoading}
        onClick={onDelete}
      >
        <Trash2 aria-hidden />
        {t("media.delete")}
      </Button>
      <div role="alert" aria-live="assertive">
        {blocked ? (
          <div
            className="border-destructive flex flex-col gap-2 rounded-md border p-4"
            data-blocked=""
          >
            <p className="text-destructive font-medium">{t("media.inUseTitle")}</p>
            <p className="text-sm">{t("media.inUseLead")}</p>
            <UsageList usages={blocked} />
          </div>
        ) : null}
      </div>
    </Section>
  );
}
