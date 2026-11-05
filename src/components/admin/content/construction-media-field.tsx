"use client";

import { Clapperboard, ImagePlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { MediaFlags, MediaThumb, mediaName } from "@/components/admin/media/media-thumb";
import { VideoPoster } from "@/components/admin/media/video-poster";
import { SortableList } from "@/components/admin/sortable/sortable-list";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { FormField, FormItem, FormMessage } from "@/components/admin/ui/form";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { t } from "@/lib/admin/messages";
import { contentMediaMax, type ConstructionUpdateForm } from "@/shared/content";
import type { AdminMedia } from "@/shared/media";
import { useAdminMediaListQuery } from "@/store/endpoints/admin-media";

type Abilities = { disabled: boolean; canUpload: boolean; canEditPoster: boolean };

/** The form's `mediaIds`, with whatever the schema or the API says about them. */
export function ConstructionMediaField(abilities: Abilities) {
  const { control } = useFormContext<ConstructionUpdateForm>();
  return (
    <FormField
      control={control}
      name="mediaIds"
      render={({ field }) => (
        <FormItem>
          <MediaList {...abilities} value={field.value} onChange={field.onChange} />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * An update's photos and video, in the order the site shows them: chosen from
 * the library with `MediaPicker`, put in order with `SortableList`. A video's
 * poster belongs to the file, so every page that shows the video gets it
 * (#25); it can be changed from here, in the same dialog the library uses.
 */
function MediaList({
  value,
  onChange,
  disabled,
  canUpload,
  canEditPoster,
}: Abilities & {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [posterOf, setPosterOf] = useState<string | null>(null);
  // Picked files are known before the list below has been fetched again.
  const [picked, setPicked] = useState<ReadonlyMap<string, AdminMedia>>(new Map());
  const [announcement, setAnnouncement] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);

  // Sorted, so putting the files in order does not fetch them again.
  const ids = useMemo(() => [...value].sort(), [value]);
  const { data, isError } = useAdminMediaListQuery(
    { ids, pageSize: contentMediaMax },
    { skip: !ids.length },
  );
  const files = useMemo(
    () => new Map([...picked, ...(data?.items ?? []).map((file) => [file.id, file] as const)]),
    [picked, data],
  );
  const items = value.map((id) => ({ id, file: files.get(id) }));
  const full = value.length >= contentMediaMax;
  const posterFile = posterOf ? files.get(posterOf) : undefined;

  const nameOf = (file: AdminMedia | undefined) =>
    file ? mediaName(file) : t(isError ? "table.error" : "table.loading");

  const removeItem = (id: string) => {
    onChange(value.filter((other) => other !== id));
    setAnnouncement(t("list.removed", { item: nameOf(files.get(id)) }));
    // The row and its button are gone; focus goes somewhere that stays.
    requestAnimationFrame(() => addButton.current?.focus());
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-sm mb-2 font-medium">{t("construction.media")}</legend>
      <p className="text-sm text-muted-foreground">{t("construction.mediaHint")}</p>

      {items.length ? (
        <SortableList
          items={items}
          label={t("construction.mediaList")}
          itemName={(item) => nameOf(item.file)}
          disabled={disabled}
          onReorder={onChange}
          renderItem={(item) => (
            <div className="flex min-w-0 flex-wrap items-start gap-3">
              {item.file ? (
                <MediaThumb item={item.file} className="size-20 shrink-0" />
              ) : (
                <Skeleton className="size-20 shrink-0 rounded-md" />
              )}
              <div className="flex min-w-40 flex-1 flex-col items-start gap-2">
                <p className="text-sm font-medium break-all">{nameOf(item.file)}</p>
                {item.file ? <MediaFlags item={item.file} /> : null}
                {item.file?.kind === "video" && !item.file.poster ? (
                  <p className="text-sm text-muted-foreground">{t("media.posterNone")}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {item.file?.kind === "video" && canEditPoster ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      aria-label={t("construction.posterOf", { name: nameOf(item.file) })}
                      onClick={() => setPosterOf(item.id)}
                    >
                      <Clapperboard aria-hidden />
                      {t("construction.poster")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    aria-label={t("list.remove", { item: nameOf(item.file) })}
                    onClick={() => removeItem(item.id)}
                  >
                    <X aria-hidden />
                    {t("construction.mediaRemove")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        />
      ) : (
        <p className="text-sm rounded-md border border-dashed p-4">
          {t("construction.mediaEmpty")}
        </p>
      )}

      <Button
        ref={addButton}
        type="button"
        variant="outline"
        className="self-start"
        disabled={disabled || full}
        onClick={() => setPicking(true)}
      >
        <ImagePlus aria-hidden />
        {t("construction.mediaAdd")}
      </Button>
      {full ? (
        <p className="text-sm">{t("construction.mediaFull", { max: contentMediaMax })}</p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        title={t("construction.mediaAdd")}
        canUpload={canUpload}
        exclude={value}
        onSelect={(file) => {
          setPicked((known) => new Map(known).set(file.id, file));
          onChange([...value, file.id]);
        }}
      />
      <Dialog
        open={Boolean(posterFile)}
        onOpenChange={(open) => {
          if (!open) setPosterOf(null);
        }}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("media.poster")}</DialogTitle>
            <DialogDescription className="break-all">
              {posterFile ? mediaName(posterFile) : ""}
            </DialogDescription>
          </DialogHeader>
          {posterFile ? (
            <VideoPoster
              item={posterFile}
              permissions={{ update: canEditPoster, upload: canUpload }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}
