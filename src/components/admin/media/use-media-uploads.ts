"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  checkUpload,
  posterFileName,
  putFile,
  UploadFailed,
  uploadProblemOf,
  type UploadProblem,
} from "@/lib/admin/upload";
import { captureFrame } from "@/lib/admin/video-frame";
import type { AdminMedia, MediaSource, UploadMimeType } from "@/shared/media";
import {
  useCreateMediaMutation,
  useRequestMediaUploadMutation,
  useUpdateMediaMutation,
} from "@/store/endpoints/admin-media";

export type UploadStatus = "uploading" | "processing" | "poster" | "done" | "failed" | "cancelled";

export type UploadEntry = {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0–1 while the file goes to the bucket. */
  progress: number;
  problem: UploadProblem | null;
  /** A video whose poster frame could not be captured; the editor picks one later. */
  posterMissing: boolean;
  media: AdminMedia | null;
};

/** A file's way into the library: presigned PUT, then processing on the server. */
export type SendFile = (
  file: Blob,
  fields: { name: string; source: MediaSource; decorative?: boolean },
  options?: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
) => Promise<AdminMedia>;

/**
 * Sends a file to the library the way every upload goes: a presigned PUT
 * from the server, the bytes straight to the bucket with progress, then the
 * server checks and processes them. Rejects with the RTK Query error or
 * `UploadFailed`.
 */
export function useSendFile(): SendFile {
  const [requestUpload] = useRequestMediaUploadMutation();
  const [createMedia] = useCreateMediaMutation();
  return useCallback<SendFile>(
    async (file, { name, source, decorative }, options = {}) => {
      const ticket = await requestUpload({
        filename: name,
        // Checked by `checkUpload` and again by the schema on the server.
        mimeType: file.type as UploadMimeType,
        size: file.size,
      }).unwrap();
      await putFile(ticket, file, options);
      return createMedia({ key: ticket.key, source, decorative, originalName: name }).unwrap();
    },
    [requestUpload, createMedia],
  );
}

/**
 * Captures a video's poster frame and links it (#25). The frame is a still of
 * the video, so it is decorative: the video's own alt text names it.
 */
export function useCapturePoster() {
  const send = useSendFile();
  const [update] = useUpdateMediaMutation();
  return useCallback(
    async (video: AdminMedia, src: string, time?: number): Promise<AdminMedia> => {
      const frame = await captureFrame(src, { time });
      const poster = await send(frame, {
        name: posterFileName(video.originalName),
        source: video.source,
        decorative: true,
      });
      return update({ id: video.id, posterMediaId: poster.id }).unwrap();
    },
    [send, update],
  );
}

let counter = 0;

/**
 * The upload queue of the library and the picker: every chosen file runs at
 * once with its own progress, status and plain-language problem. A video
 * gets its poster frame right after it is processed. Cancelling stops a file
 * still on its way to the bucket.
 */
export function useMediaUploads({
  source = "owner",
  onUploaded,
}: { source?: MediaSource; onUploaded?: (media: AdminMedia) => void } = {}) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const send = useSendFile();
  const capturePoster = useCapturePoster();
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  // Uploads still running when the page goes away are cancelled.
  useEffect(() => {
    const running = controllers.current;
    return () => running.forEach((controller) => controller.abort());
  }, []);

  const patch = useCallback((id: string, change: Partial<UploadEntry>) => {
    setEntries((list) => list.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)));
  }, []);

  const run = useCallback(
    async (id: string, file: File) => {
      const controller = new AbortController();
      controllers.current.set(id, controller);
      let media: AdminMedia;
      try {
        media = await send(
          file,
          { name: file.name, source },
          {
            signal: controller.signal,
            onProgress: (progress) =>
              patch(id, progress < 1 ? { progress } : { progress, status: "processing" }),
          },
        );
      } catch (error) {
        if (error instanceof UploadFailed) {
          patch(
            id,
            error.reason === "aborted"
              ? { status: "cancelled" }
              : {
                  status: "failed",
                  problem: error.reason === "network" ? "network" : "storage",
                },
          );
        } else {
          patch(id, { status: "failed", problem: uploadProblemOf(error) });
        }
        return;
      } finally {
        controllers.current.delete(id);
      }

      if (media.kind === "video") {
        patch(id, { status: "poster", media });
        const local = URL.createObjectURL(file);
        try {
          media = await capturePoster(media, local);
        } catch (error) {
          console.warn("media: the poster frame could not be captured", error);
          patch(id, { posterMissing: true });
        } finally {
          URL.revokeObjectURL(local);
        }
      }
      patch(id, { status: "done", media, progress: 1 });
      onUploadedRef.current?.(media);
    },
    [send, capturePoster, patch, source],
  );

  const add = useCallback(
    (files: Iterable<File>) => {
      const added: Array<[UploadEntry, File]> = [...files].map((file) => {
        const checked = checkUpload(file);
        const problem = checked === "image" || checked === "video" ? null : checked;
        counter += 1;
        return [
          {
            id: `upload-${counter}`,
            name: file.name,
            size: file.size,
            status: problem ? "failed" : "uploading",
            progress: 0,
            problem,
            posterMissing: false,
            media: null,
          },
          file,
        ];
      });
      setEntries((list) => [...added.map(([entry]) => entry), ...list]);
      for (const [entry, file] of added) {
        if (!entry.problem) void run(entry.id, file);
      }
    },
    [run],
  );

  const cancel = useCallback((id: string) => controllers.current.get(id)?.abort(), []);

  const dismiss = useCallback(
    (id: string) => setEntries((list) => list.filter((entry) => entry.id !== id)),
    [],
  );

  const clearFinished = useCallback(
    () =>
      setEntries((list) =>
        list.filter((entry) => !["done", "failed", "cancelled"].includes(entry.status)),
      ),
    [],
  );

  return { entries, add, cancel, dismiss, clearFinished };
}
