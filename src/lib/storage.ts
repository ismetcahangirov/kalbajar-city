import "server-only";

import { S3, s3ConfigFromEnv } from "./s3";

export { S3Error } from "./s3";

/**
 * Bucket layout (#11). Only `media/*` is public-read (`pnpm storage:setup`):
 *
 * - `uploads/<uuid>`: presigned PUT targets, expired by the bucket after a day
 * - `originals/<mediaId>.<ext>`: the untouched original, private, kept for reprocessing
 * - `media/<mediaId>/<width>.<avif|webp>` and `media/<mediaId>/video.mp4`: what pages load
 */
export const storageKeys = {
  upload: (token: string) => `uploads/${token}`,
  original: (mediaId: string, extension: string) => `originals/${mediaId}.${extension}`,
  variant: (mediaId: string, width: number, format: "avif" | "webp") =>
    `media/${mediaId}/${width}.${format}`,
  video: (mediaId: string) => `media/${mediaId}/video.mp4`,
};

/** Public files never change under their key: a new upload gets a new id. */
export const immutable = "public, max-age=31536000, immutable";

const globalForStorage = globalThis as unknown as { storage?: S3 };

/**
 * The application's bucket. It reads `S3_*` on first use, never at module
 * scope, so `next build` needs no storage configuration.
 */
export function storage(): S3 {
  globalForStorage.storage ??= new S3(s3ConfigFromEnv());
  return globalForStorage.storage;
}
