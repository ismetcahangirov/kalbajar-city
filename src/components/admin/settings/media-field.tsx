"use client";

import { ImageIcon, X } from "lucide-react";
import { useState } from "react";

import { MediaFlags, MediaThumb, mediaName } from "@/components/admin/media/media-thumb";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { t } from "@/lib/admin/messages";
import { useAdminMediaQuery } from "@/store/endpoints/admin-media";

/**
 * An image chosen from the media library (`MediaPicker`), by id: its
 * thumbnail and name, a button to choose or change it and one to clear it.
 */
export function MediaField({
  label,
  description,
  value,
  onChange,
  disabled = false,
  canUpload = false,
}: {
  label: string;
  description?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  canUpload?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: item, isFetching } = useAdminMediaQuery(value ?? "", { skip: !value });
  const current = value && item?.id === value ? item : null;

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
            <ImageIcon aria-hidden />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm break-all">
            {current
              ? t("picker.selected", { name: mediaName(current) })
              : value
                ? t("table.loading")
                : t("picker.none")}
          </p>
          {current ? <MediaFlags item={current} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              {value ? t("picker.change") : t("picker.pick")}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(null)}
              >
                <X aria-hidden />
                {t("picker.remove")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind="image"
        title={label}
        canUpload={canUpload}
        exclude={value ? [value] : []}
        onSelect={(picked) => onChange(picked.id)}
      />
    </fieldset>
  );
}
