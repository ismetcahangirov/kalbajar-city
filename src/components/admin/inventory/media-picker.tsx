"use client";

import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import type { AdminPlan } from "@/shared/inventory";
import type { AdminMedia } from "@/shared/media";
import { useAdminMediaListQuery } from "@/store/endpoints/admin-media";

const pageSize = 12;

const altOf = (item: Pick<AdminMedia, "alt">) => item.alt?.az?.trim() || null;

/** A preview the console shows at a fixed size; the file comes from the bucket's public URL. */
function Thumb({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  return src ? (
    // The console shows library previews as they are; the public site's
    // <Picture> handles responsive images.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("bg-muted object-contain", className)} />
  ) : (
    <span className={cn("bg-muted flex items-center justify-center", className)}>
      <ImageIcon aria-hidden className="text-muted-foreground" />
    </span>
  );
}

/**
 * A plan image picked from the media library (images only). Uploading
 * arrives with the media library's own screen; the console's CSP does not
 * let it send files to the bucket yet.
 */
export function MediaPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  /** The chosen image, as the list endpoints describe it. */
  value: AdminPlan | null;
  onChange: (plan: AdminPlan | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const name = value ? (value.alt ?? t("picker.untitled")) : null;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm mb-2 font-medium">{label}</legend>
      <div className="flex flex-wrap items-center gap-3">
        <Thumb
          src={value?.previewUrl ?? null}
          alt={value ? t("picker.selected", { name: name! }) : t("picker.none")}
          className="size-24 rounded-md border"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <ImageIcon aria-hidden />
            {value ? t("picker.change") : t("picker.pick")}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              <X aria-hidden />
              {t("picker.remove")}
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("picker.title")}</DialogTitle>
            <DialogDescription>{t("picker.lead")}</DialogDescription>
          </DialogHeader>
          {open ? (
            <Library
              selectedId={value?.id ?? null}
              onPick={(item) => {
                onChange({ id: item.id, previewUrl: item.previewUrl, alt: altOf(item) });
                setOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}

function Library({
  selectedId,
  onPick,
}: {
  selectedId: string | null;
  onPick: (item: AdminMedia) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useAdminMediaListQuery({
    kind: ["image"],
    page,
    pageSize,
  });

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
  if (!isLoading && !data?.items.length) {
    return <p className="rounded-md border border-dashed p-6">{t("picker.empty")}</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }, (_, index) => (
              <li key={index}>
                <Skeleton className="aspect-square w-full" />
              </li>
            ))
          : data!.items.map((item) => {
              const alt = altOf(item);
              const label = alt ?? t("picker.untitled");
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === selectedId}
                    aria-label={t("picker.choose", { name: label })}
                    onClick={() => onPick(item)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-md border p-1 text-left",
                      item.id === selectedId && "border-primary border-2",
                    )}
                  >
                    <Thumb
                      src={item.previewUrl}
                      alt=""
                      className="aspect-square w-full rounded-sm"
                    />
                    <span className="text-sm line-clamp-2">{label}</span>
                    {item.missingAlt ? (
                      <span className="text-sm text-destructive">{t("picker.missingAlt")}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
      </ul>
      {data && data.pageCount > 1 ? (
        <nav aria-label={t("table.pagination")} className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft aria-hidden />
            {t("table.previous")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("table.page", { page, pageCount: data.pageCount })}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={page >= data.pageCount}
            onClick={() => setPage(page + 1)}
          >
            {t("table.next")}
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
