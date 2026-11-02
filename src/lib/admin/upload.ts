import { apiErrorOf } from "@/store/errors";
import { uploadTypes, type MediaKind, type UploadTicket } from "@/shared/media";

import { t } from "./messages";

/**
 * The browser's half of a media upload (#25): checks before anything is
 * sent, the PUT to the bucket with progress, and what to tell the editor
 * when a step fails. The steps around it are RTK Query mutations
 * (`requestMediaUpload`, `createMedia`).
 */

/** Why a file was not added to the library, in words for the editor. */
export type UploadProblem = "type" | "size" | "codec" | "network" | "storage" | "generic";

const megabyte = 1024 * 1024;

/** What the file input offers: the types the library takes. */
export const uploadAccept = Object.keys(uploadTypes).join(",");

/**
 * The kind of a file the library takes, or the problem with it. The server
 * checks the bytes again; this spares the editor a pointless upload.
 */
export function checkUpload(file: Pick<File, "type" | "size">): MediaKind | UploadProblem {
  const type = uploadTypes[file.type as keyof typeof uploadTypes];
  if (!type) return "type";
  if (file.size === 0 || file.size > type.maxBytes) return "size";
  return type.kind;
}

/** The problem behind a failed `requestMediaUpload` or `createMedia`. */
export function uploadProblemOf(error: unknown): UploadProblem {
  const body = apiErrorOf(error);
  if (!body) {
    const status = (error as { status?: unknown } | null)?.status;
    return status === "FETCH_ERROR" ? "network" : "generic";
  }
  switch (body.code) {
    case "UNSUPPORTED_FILE":
      return "type";
    case "UNSUPPORTED_VIDEO_CODEC":
      return "codec";
    case "FILE_TOO_LARGE":
      return "size";
    case "VALIDATION_FAILED":
      if (body.fields?.size) return "size";
      if (body.fields?.mimeType) return "type";
      // The upload expired or never reached the bucket.
      if (body.fields?.key) return "storage";
      return "generic";
    default:
      return "generic";
  }
}

export function uploadProblemMessage(problem: UploadProblem): string {
  return t(`upload.problem.${problem}`, {
    image: uploadTypes["image/jpeg"].maxBytes / megabyte,
    video: uploadTypes["video/mp4"].maxBytes / megabyte,
  });
}

/** A failed PUT: the bucket's status, or why there was none. */
export class UploadFailed extends Error {
  constructor(readonly reason: "network" | "aborted" | number) {
    super(typeof reason === "number" ? `The bucket answered ${reason}` : `Upload ${reason}`);
    this.name = "UploadFailed";
  }
}

/**
 * Sends `file` to the presigned URL. `XMLHttpRequest`, not `fetch`: only it
 * reports upload progress. Rejects with `UploadFailed`; `signal` cancels.
 */
export function putFile(
  ticket: Pick<UploadTicket, "url" | "method" | "headers">,
  file: Blob,
  { onProgress, signal }: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadFailed("aborted"));
      return;
    }
    const request = new XMLHttpRequest();
    request.open(ticket.method, ticket.url);
    for (const [name, value] of Object.entries(ticket.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    });
    const abort = () => request.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const settle = (error?: UploadFailed) => {
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        settle();
      } else {
        settle(new UploadFailed(request.status));
      }
    });
    request.addEventListener("error", () => settle(new UploadFailed("network")));
    request.addEventListener("abort", () => settle(new UploadFailed("aborted")));
    request.send(file);
  });
}

/** `kənd.mp4` → `kənd-poster.jpg`: the name of a video's captured poster frame. */
export function posterFileName(videoName: string | null | undefined): string {
  const base = (videoName ?? "video").replace(/\.[^./\\]+$/, "") || "video";
  return `${base}-poster.jpg`;
}
