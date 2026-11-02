"use client";

import { CircleAlert, CircleCheck, ImageUp, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/admin/ui/button";
import { Progress } from "@/components/admin/ui/progress";
import { mediaItemHref, formatFileSize } from "@/lib/admin/media-list";
import { t } from "@/lib/admin/messages";
import { uploadAccept, uploadProblemMessage } from "@/lib/admin/upload";
import { cn } from "@/lib/admin/utils";

import type { UploadEntry, useMediaUploads } from "./use-media-uploads";

type Uploads = ReturnType<typeof useMediaUploads>;

/**
 * Where files enter the library: drop them on the zone or choose them with
 * the button (on a phone, the photo library or the camera). Several at once.
 */
export function UploadZone({
  onFiles,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) onFiles([...event.dataTransfer.files]);
  };

  return (
    <div
      data-upload-zone=""
      data-dragging={dragging || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={cn(
        "flex flex-col items-start gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center",
        dragging ? "border-ring bg-secondary" : "border-input",
        compact ? "p-3" : "md:p-6",
      )}
    >
      <ImageUp aria-hidden className="text-muted-foreground size-6 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{t("upload.drop")}</p>
        <p id={hintId} className="text-sm text-muted-foreground">
          {t("upload.hint")}
        </p>
      </div>
      <Button type="button" aria-describedby={hintId} onClick={() => input.current?.click()}>
        {t("upload.choose")}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={uploadAccept}
        aria-label={t("upload.input")}
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // The same file can be chosen again after a failure.
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

const statusKey = {
  uploading: "upload.status.uploading",
  processing: "upload.status.processing",
  poster: "upload.status.poster",
  done: "upload.status.done",
  failed: "upload.status.failed",
  cancelled: "upload.status.cancelled",
} as const;

/** Every file of this visit's uploads with its progress, then its outcome in words. */
export function UploadList({
  uploads,
  linkItems = true,
}: {
  uploads: Uploads;
  linkItems?: boolean;
}) {
  const { entries, cancel, dismiss, clearFinished } = uploads;
  if (!entries.length) return null;
  const finished = entries.some((entry) => ["done", "failed", "cancelled"].includes(entry.status));

  return (
    <section aria-label={t("upload.list")} className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <UploadRow
            key={entry.id}
            entry={entry}
            linkItem={linkItems}
            onCancel={() => cancel(entry.id)}
            onDismiss={() => dismiss(entry.id)}
          />
        ))}
      </ul>
      {finished ? (
        <Button type="button" variant="ghost" className="self-start" onClick={clearFinished}>
          {t("upload.clear")}
        </Button>
      ) : null}
    </section>
  );
}

function UploadRow({
  entry,
  linkItem,
  onCancel,
  onDismiss,
}: {
  entry: UploadEntry;
  linkItem: boolean;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const percent = Math.round(entry.progress * 100);
  const running = ["uploading", "processing", "poster"].includes(entry.status);
  const failed = entry.status === "failed";

  return (
    <li
      data-upload={entry.name}
      data-status={entry.status}
      className="bg-card flex flex-col gap-2 rounded-md border p-3"
    >
      <div className="flex items-start gap-2">
        {entry.status === "done" ? (
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-status-available" />
        ) : failed ? (
          <CircleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate font-medium">{entry.name}</p>
          <p className="text-sm text-muted-foreground" role="status">
            {t(statusKey[entry.status], { percent })} · {formatFileSize(entry.size)}
          </p>
        </div>
        {entry.status === "uploading" ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            <X aria-hidden />
            {t("ui.cancel")}
            <span className="sr-only">: {entry.name}</span>
          </Button>
        ) : !running ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("upload.dismiss", { name: entry.name })}
            onClick={onDismiss}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      {entry.status === "uploading" ? (
        <Progress
          value={percent}
          aria-label={t("upload.progress", { name: entry.name })}
          aria-valuetext={`${percent}%`}
        />
      ) : null}
      {failed && entry.problem ? (
        <p className="text-sm text-destructive" role="alert">
          {uploadProblemMessage(entry.problem)}
        </p>
      ) : null}
      {entry.status === "done" && entry.media ? (
        <div className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
          {entry.media.missingAlt ? <span>{t("upload.needsAlt")}</span> : null}
          {entry.posterMissing ? <span>{t("upload.posterMissing")}</span> : null}
          {linkItem ? (
            <Link
              href={mediaItemHref(entry.media.id)}
              className="inline-flex min-h-(--spacing-target) items-center font-medium underline underline-offset-4 md:min-h-0"
            >
              {t("upload.open")}
              <span className="sr-only">: {entry.name}</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
