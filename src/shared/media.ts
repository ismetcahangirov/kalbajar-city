import { z } from "zod";

import type { Translatable } from "@/i18n/content";

import { listOf, paginationSchema } from "./api";
import { translatableSchema } from "./translatable";

/**
 * The media library (#11): what the console sends and receives. Files go
 * straight to the bucket with a presigned PUT; the server then checks and
 * processes them (`POST /api/v1/admin/media`).
 */

export const mediaKinds = ["image", "video"] as const;

export type MediaKind = (typeof mediaKinds)[number];

/**
 * `owner`: photos, renders and video from the owner. `generated`: atmosphere
 * only, always shown as illustrative (`CLAUDE.md` §3, Imagery). `stock`:
 * licensed photography.
 */
export const mediaSources = ["owner", "generated", "stock"] as const;

export type MediaSource = (typeof mediaSources)[number];

export const variantFormats = ["avif", "webp"] as const;

export type VariantFormat = (typeof variantFormats)[number];

/** A resized copy of an image, stored under `media/<id>/`. */
export type MediaVariant = {
  format: VariantFormat;
  width: number;
  height: number;
  key: string;
  /** Bytes. */
  size: number;
};

/** Variant widths; none is ever wider than the original. */
export const variantWidths = [480, 960, 1600, 2400] as const;

/**
 * The widths to make for an image `width` px wide: every standard width below
 * it, and the original's own width when it is narrower than the largest, so
 * nothing is upscaled and the sharpest variant is min(width, 2400).
 */
export function planVariantWidths(width: number): number[] {
  const largest = Math.min(width, variantWidths[variantWidths.length - 1]!);
  return [...variantWidths.filter((candidate) => candidate < largest), largest];
}

const megabyte = 1024 * 1024;

/** What an editor may upload, by declared type; the server checks the bytes again. */
export const uploadTypes = {
  "image/jpeg": { kind: "image", maxBytes: 40 * megabyte },
  "image/png": { kind: "image", maxBytes: 40 * megabyte },
  "image/webp": { kind: "image", maxBytes: 40 * megabyte },
  "image/avif": { kind: "image", maxBytes: 40 * megabyte },
  "video/mp4": { kind: "video", maxBytes: 80 * megabyte },
} as const satisfies Record<string, { kind: MediaKind; maxBytes: number }>;

export type UploadMimeType = keyof typeof uploadTypes;

export const uploadMimeTypes = Object.keys(uploadTypes) as [UploadMimeType, ...UploadMimeType[]];

/** The largest file of any type, in bytes. */
export const maxUploadBytes = Math.max(...Object.values(uploadTypes).map((type) => type.maxBytes));

/** `POST /api/v1/admin/media/uploads`: asks for a presigned PUT. */
export const uploadRequestSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    mimeType: z.enum(uploadMimeTypes),
    size: z.int().positive(),
  })
  .superRefine((value, ctx) => {
    const limit = uploadTypes[value.mimeType].maxBytes;
    if (value.size > limit) {
      ctx.addIssue({
        code: "custom",
        path: ["size"],
        message: `A ${value.mimeType} file may be at most ${limit / megabyte} MB`,
      });
    }
  });

export type UploadRequest = z.input<typeof uploadRequestSchema>;

/**
 * Where to send the file: `PUT url` with exactly `headers` (they are signed,
 * so another type or length is refused), before `expiresAt`. Then pass `key`
 * to `POST /api/v1/admin/media`.
 */
export type UploadTicket = {
  key: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

/** Keys the upload endpoint hands out: `uploads/<uuid>`. */
export const uploadKeySchema = z
  .string()
  .regex(
    /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "Unknown upload",
  );

const focus = z.number().min(0).max(1);

/** `POST /api/v1/admin/media`: turns an upload into a library item. */
export const mediaCreateSchema = z.object({
  key: uploadKeySchema,
  source: z.enum(mediaSources).default("owner"),
  illustrative: z.boolean().optional(),
  decorative: z.boolean().default(false),
  alt: translatableSchema.nullish(),
  caption: translatableSchema.nullish(),
  focusX: focus.default(0.5),
  focusY: focus.default(0.5),
});

export type MediaCreate = z.input<typeof mediaCreateSchema>;

/** `PATCH /api/v1/admin/media/:id`. `null` clears alt text or a caption. */
export const mediaUpdateSchema = z
  .object({
    alt: translatableSchema.nullable(),
    caption: translatableSchema.nullable(),
    focusX: focus,
    focusY: focus,
    source: z.enum(mediaSources),
    illustrative: z.boolean(),
    decorative: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");

export type MediaUpdate = z.input<typeof mediaUpdateSchema>;

/** `GET /api/v1/admin/media`, newest first. */
export const mediaListQuerySchema = paginationSchema.extend({
  kind: listOf(z.enum(mediaKinds)),
  source: listOf(z.enum(mediaSources)),
});

export type MediaListParams = {
  page?: number;
  pageSize?: number;
  kind?: MediaKind[];
  source?: MediaSource[];
};

export const mediaIdParamsSchema = z.object({ id: z.uuid() });

/** One place a file is used. */
export type MediaUsage = {
  /** The table, e.g. `news` or `home_section`. */
  entityType: string;
  entityId: string;
  /** The field or slot, e.g. `cover`, or the JSON path in a home section. */
  field: string;
  /** Something a person recognises: a slug, a code, a section key. */
  label: string | null;
};

export type AdminMedia = {
  id: string;
  kind: MediaKind;
  source: MediaSource;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  codec: string | null;
  alt: Translatable | null;
  caption: Translatable | null;
  focusX: number;
  focusY: number;
  illustrative: boolean;
  decorative: boolean;
  /** No `alt.az` and not decorative: the public site will not show it until fixed. */
  missingAlt: boolean;
  dominantColor: string | null;
  lqip: string | null;
  variants: Array<MediaVariant & { url: string }>;
  /** The smallest variant of an image, or the video file. */
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMediaDetail = AdminMedia & { usages: MediaUsage[] };

/** The 409 a delete of a file in use answers: the shared error shape plus `usages`. */
export type MediaInUseError = {
  error: { code: "MEDIA_IN_USE"; message: string; usages: MediaUsage[] };
};
