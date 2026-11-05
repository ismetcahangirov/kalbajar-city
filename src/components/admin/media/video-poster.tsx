"use client";

import { Camera, Images, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { FormAlert } from "@/components/admin/form-alert";
import { toast, toastApiError } from "@/components/admin/feedback/toast";
import { Button } from "@/components/admin/ui/button";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { mediaItemHref } from "@/lib/admin/media-list";
import { t } from "@/lib/admin/messages";
import { corsUrl } from "@/lib/admin/video-frame";
import type { AdminMedia } from "@/shared/media";
import { apiErrorOf } from "@/store/errors";
import { useUpdateMediaMutation } from "@/store/endpoints/admin-media";

import { MediaPicker } from "./media-picker";
import { mediaName } from "./media-thumb";
import { useCapturePoster } from "./use-media-uploads";

/**
 * A video's poster: the frame shown until it plays. The editor scrubs the
 * video and captures the frame on screen, or picks an image from the library.
 */
export function VideoPoster({
  item,
  permissions,
}: {
  item: AdminMedia;
  permissions: { update: boolean; upload: boolean };
}) {
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
