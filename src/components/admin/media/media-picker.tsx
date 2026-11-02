"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import { searchTextMax } from "@/lib/admin/table-state";
import { cn } from "@/lib/admin/utils";
import { mediaKinds, type AdminMedia, type MediaKind } from "@/shared/media";
import { useAdminMediaListQuery } from "@/store/endpoints/admin-media";

import { MediaFlags, MediaThumb, mediaName } from "./media-thumb";
import { UploadList, UploadZone } from "./upload-zone";
import { useMediaUploads } from "./use-media-uploads";

const pageSize = 24;

export type MediaPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen file; the dialog closes. */
  onSelect: (item: AdminMedia) => void;
  /** Only images, or only videos; both when left out. */
  kind?: MediaKind;
  title?: string;
  /** The editor may upload a new file from the dialog. */
  canUpload?: boolean;
  /** Files that cannot be chosen, e.g. the current one. */
  exclude?: readonly string[];
};

/**
 * Chooses a file from the library (#25), for any module that links media:
 * search, a kind filter when both kinds are allowed, and an upload zone, so a
 * file that is not in the library yet is one step away. A new upload appears
 * at the top of the list, ready to be chosen.
 */
export function MediaPicker(props: MediaPickerProps) {
  const { open, onOpenChange, title } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title ?? t("mediaPicker.title")}</DialogTitle>
          <DialogDescription>{t("mediaPicker.lead")}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: a closed picker loads nothing. */}
        {open ? <PickerBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  onSelect,
  onOpenChange,
  kind,
  canUpload = false,
  exclude = [],
}: MediaPickerProps) {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<MediaKind | null>(kind ?? null);
  const [shown, setShown] = useState(pageSize);
  const query = useDeferredValue(search.trim());
  const uploads = useMediaUploads();

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminMediaListQuery({
    pageSize: shown,
    q: query || undefined,
    kind: kindFilter ? [kindFilter] : undefined,
  });
  const items = data?.items ?? [];

  const choose = (item: AdminMedia) => {
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">{t("media.search")}</span>
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute left-3 size-4"
          />
          <Input
            type="search"
            className="pl-9"
            placeholder={t("media.search")}
            maxLength={searchTextMax}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShown(pageSize);
            }}
          />
        </label>
        {kind ? null : (
          <div role="group" aria-label={t("media.kind")} className="flex gap-1">
            {[null, ...mediaKinds].map((value) => (
              <Button
                key={value ?? "all"}
                type="button"
                variant={kindFilter === value ? "secondary" : "ghost"}
                aria-pressed={kindFilter === value}
                onClick={() => {
                  setKindFilter(value);
                  setShown(pageSize);
                }}
              >
                {value ? t(`media.kind.${value}`) : t("mediaPicker.all")}
              </Button>
            ))}
          </div>
        )}
      </div>

      {canUpload ? (
        <div className="flex flex-col gap-2">
          <UploadZone onFiles={uploads.add} compact />
          <UploadList uploads={uploads} linkItems={false} />
        </div>
      ) : null}

      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2" aria-busy={isFetching}>
        {isError && !data ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-destructive">
              {t("table.error")} {apiErrorMessage(error)}
            </p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              {t("ui.retry")}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="aspect-square w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">{t("mediaPicker.empty")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t("mediaPicker.title")}>
            {items.map((item) => {
              const disabled = exclude.includes(item.id) || (kind ? item.kind !== kind : false);
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(item)}
                    className={cn(
                      "hover:bg-secondary flex w-full min-w-0 flex-col gap-2 rounded-md p-1 text-left",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <MediaThumb item={item} />
                    <span className="text-sm truncate font-medium">
                      <span className="sr-only">{t("mediaPicker.choose")}: </span>
                      {mediaName(item)}
                    </span>
                    <MediaFlags item={item} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.total > items.length ? (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          onClick={() => setShown((count) => Math.min(count + pageSize, 100))}
          disabled={shown >= 100}
        >
          {t("mediaPicker.more")}
        </Button>
      ) : null}
    </div>
  );
}
