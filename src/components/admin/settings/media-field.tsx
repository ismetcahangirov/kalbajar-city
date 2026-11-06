"use client";

import { Film, ImageIcon, X } from "lucide-react";
import { useState } from "react";

import { MediaFlags, MediaThumb, mediaName } from "@/components/admin/media/media-thumb";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { t } from "@/lib/admin/messages";
import type { MediaKind } from "@/shared/media";
import { useAdminMediaQuery } from "@/store/endpoints/admin-media";

/**
 * A file chosen from the media library (`MediaPicker`), by id: its thumbnail
 * and name, a button to choose or change it and one to clear it. `hasDefault`
 * says that an empty slot shows a bundled default on the site, not nothing.
 */
export function MediaField({
  label,
  description,
  value,
  onChange,
  disabled = false,
  canUpload = false,
  kind = "image",
  hasDefault = false,
  clearable = true,
}: {
  label: string;
  description?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  canUpload?: boolean;
  kind?: MediaKind;
  hasDefault?: boolean;
  /** Whether the slot may be empty; a list's item is removed with the list's own button. */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: item, isFetching } = useAdminMediaQuery(value ?? "", { skip: !value });
  const current = value && item?.id === value ? item : null;
  const video = kind === "video";
  const empty = hasDefault
    ? t("picker.defaultShown")
    : video
      ? t("picker.noVideo")
      : t("picker.none");

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm mb-2 font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-4">
        {current ? (
          <MediaThumb item={current} className="size-24 shrink-0" />
        ) : value && isFetching ? (
          <Skeleton className="size-24 shrink-0 rounded-md" />
        ) : (
          <span className="bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-md">
            {video ? <Film aria-hidden /> : <ImageIcon aria-hidden />}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm break-all">
            {current
              ? t("picker.selected", { name: mediaName(current) })
              : value
                ? t("table.loading")
                : empty}
          </p>
          {current ? <MediaFlags item={current} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              {video
                ? value
                  ? t("picker.changeVideo")
                  : t("picker.pickVideo")
                : value
                  ? t("picker.change")
                  : t("picker.pick")}
            </Button>
            {value && clearable ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(null)}
              >
                <X aria-hidden />
                {video ? t("picker.removeVideo") : t("picker.remove")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        title={label}
        canUpload={canUpload}
        exclude={value ? [value] : []}
        onSelect={(picked) => onChange(picked.id)}
      />
    </fieldset>
  );
}
