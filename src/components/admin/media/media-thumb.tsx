import { CircleAlert, Film, Sparkles } from "lucide-react";

import { t } from "@/lib/admin/messages";
import { cn } from "@/lib/admin/utils";
import type { AdminMedia } from "@/shared/media";

/** The file's name for the editor: the original name, or a stand-in. */
export function mediaName(item: Pick<AdminMedia, "originalName">): string {
  return item.originalName ?? t("media.untitled");
}

/** What a thumbnail shows: an image's smallest variant, a video's poster. */
export function thumbUrl(item: AdminMedia): string | null {
  return item.kind === "image" ? item.previewUrl : (item.poster?.previewUrl ?? null);
}

/**
 * A square thumbnail cropped around the focus point, painted with the
 * dominant colour until it loads. Decorative: the name and the alt text are
 * written beside it, so the image itself is not announced.
 */
export function MediaThumb({ item, className }: { item: AdminMedia; className?: string }) {
  const url = thumbUrl(item);
  return (
    <div
      className={cn("bg-muted relative aspect-square overflow-hidden rounded-md", className)}
      style={item.dominantColor ? { backgroundColor: item.dominantColor } : undefined}
    >
      {url ? (
        // The library's own variants, already sized: no Next image optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          style={{ objectPosition: `${item.focusX * 100}% ${item.focusY * 100}%` }}
        />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center">
          <Film aria-hidden className="size-8" />
        </div>
      )}
      {item.kind === "video" ? (
        <span className="bg-background/90 text-xs absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-medium">
          <Film aria-hidden className="size-3" />
          {t("media.kind.video")}
        </span>
      ) : null}
    </div>
  );
}

/** The flags an editor must see at a glance, in words: never colour alone. */
export function MediaFlags({ item }: { item: AdminMedia }) {
  if (!item.missingAlt && !item.illustrative) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {item.missingAlt ? (
        <span className="border-destructive text-destructive text-xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium">
          <CircleAlert aria-hidden className="size-3" />
          {t("media.missingAlt")}
        </span>
      ) : null}
      {item.illustrative ? (
        <span className="text-xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium">
          <Sparkles aria-hidden className="size-3" />
          {t("media.illustrative")}
        </span>
      ) : null}
    </span>
  );
}
