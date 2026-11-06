import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { Executor } from "@/db/client";
import { media } from "@/db/schema";
import { HttpError, invalidField, notFound } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { revalidatePublic } from "@/lib/cache/revalidate";
import { publicTags } from "@/lib/cache/tags";
import { imageMimeTypes, probeImage, processImage, type ImageFormat } from "@/lib/media/image";
import { isH264, parseMp4 } from "@/lib/media/mp4";
import { mediaUsages } from "@/lib/media/usages";
import { mediaUrl } from "@/lib/public/media";
import { immutable, storage, storageKeys } from "@/lib/storage";
import { offsetOf, toPage, type Page } from "@/shared/api";
import {
  maxUploadBytes,
  uploadTypes,
  type AdminMedia,
  type AdminMediaDetail,
  type MediaVariant,
  type UploadTicket,
  type mediaCreateSchema,
  type mediaListQuerySchema,
  type mediaUpdateSchema,
  type uploadRequestSchema,
} from "@/shared/media";

type MediaRow = typeof media.$inferSelect;

/** How long a presigned upload URL stays valid. */
const uploadTtlSeconds = 15 * 60;

const extensions: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

/** The smallest WebP of an image, or the file of a video. */
function previewOf(row: MediaRow): string | null {
  if (row.kind === "video") return mediaUrl(row.key);
  const webp = row.variants
    .filter((variant) => variant.format === "webp")
    .sort((a, b) => a.width - b.width)[0];
  return webp ? mediaUrl(webp.key) : null;
}

/** `poster` is the video's poster row, when it has one. */
export function toAdminMedia(row: MediaRow, poster?: MediaRow): AdminMedia {
  const variants = row.variants.map((variant) => ({
    ...variant,
    url: mediaUrl(variant.key) ?? "",
  }));
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    codec: row.codec,
    alt: row.alt,
    caption: row.caption,
    focusX: row.focusX,
    focusY: row.focusY,
    illustrative: row.illustrative,
    decorative: row.decorative,
    missingAlt: row.kind === "image" && !row.decorative && !row.alt?.az?.trim(),
    dominantColor: row.dominantColor,
    lqip: row.lqip,
    variants,
    previewUrl: previewOf(row),
    originalName: row.originalName,
    poster:
      row.posterMediaId && poster?.id === row.posterMediaId
        ? { id: poster.id, previewUrl: previewOf(poster) }
        : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The library items for rows, each video with its poster. */
async function toAdminMediaList(db: Executor, rows: MediaRow[]): Promise<AdminMedia[]> {
  const ids = [...new Set(rows.flatMap((row) => (row.posterMediaId ? [row.posterMediaId] : [])))];
  const posters = new Map(
    ids.length
      ? (await db.select().from(media).where(inArray(media.id, ids))).map((row) => [row.id, row])
      : [],
  );
  return rows.map((row) =>
    toAdminMedia(row, row.posterMediaId ? posters.get(row.posterMediaId) : undefined),
  );
}

/**
 * A presigned PUT to a fresh `uploads/<uuid>` key. Type and length are
 * signed, so the store refuses any other file; the bucket expires what is
 * never processed.
 */
export async function createUploadTicket(
  input: z.output<typeof uploadRequestSchema>,
): Promise<UploadTicket> {
  const key = storageKeys.upload(randomUUID());
  const headers = { "content-type": input.mimeType, "content-length": String(input.size) };
  const url = await storage().presignPut(key, { headers, expiresIn: uploadTtlSeconds });
  return {
    key,
    url,
    method: "PUT",
    // The browser sets Content-Length itself; it must equal the declared size.
    headers: { "content-type": input.mimeType },
    expiresAt: new Date(Date.now() + uploadTtlSeconds * 1000).toISOString(),
  };
}

type Stored = Pick<
  MediaRow,
  | "key"
  | "kind"
  | "mimeType"
  | "size"
  | "width"
  | "height"
  | "durationMs"
  | "codec"
  | "sha256"
  | "dominantColor"
  | "lqip"
  | "variants"
>;

const unsupported = () =>
  new HttpError(
    422,
    "UNSUPPORTED_FILE",
    "Upload a JPEG, PNG, WebP or AVIF image, or an H.264 MP4 video.",
  );

/**
 * Checks what the upload really is (never the declared type) and writes what
 * pages load: variants of an image, the file of a video. Returns the row's
 * file fields and every key written, for cleanup on failure.
 */
async function store(id: string, uploadKey: string, written: string[]): Promise<Stored> {
  const bucket = storage();
  const head = await bucket.head(uploadKey);
  if (!head) throw invalidField("key", "The upload was not found or has expired.");
  if (head.size > maxUploadBytes) throw tooLarge(maxUploadBytes);

  const bytes = await bucket.get(uploadKey);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const image = await probeImage(bytes);
  if (image) {
    const mimeType = imageMimeTypes[image.format];
    const limit = uploadTypes[mimeType].maxBytes;
    if (bytes.byteLength > limit) throw tooLarge(limit);

    const processed = await processImage(bytes);
    const variants: MediaVariant[] = processed.outputs.map((output) => ({
      format: output.format,
      width: output.width,
      height: output.height,
      key: storageKeys.variant(id, output.width, output.format),
      size: output.body.byteLength,
    }));
    const original = storageKeys.original(id, extensions[image.format]);
    written.push(original, ...variants.map((variant) => variant.key));
    await Promise.all([
      bucket.copy(uploadKey, original, { contentType: mimeType }),
      ...processed.outputs.map((output, index) =>
        bucket.put(variants[index]!.key, output.body, {
          contentType: `image/${output.format}`,
          cacheControl: immutable,
        }),
      ),
    ]);
    return {
      key: original,
      kind: "image",
      mimeType,
      size: bytes.byteLength,
      width: processed.width,
      height: processed.height,
      durationMs: null,
      codec: null,
      sha256,
      dominantColor: processed.dominantColor,
      lqip: processed.lqip,
      variants,
    };
  }

  const mp4 = parseMp4(bytes);
  if (!mp4) throw unsupported();
  if (!isH264(mp4)) {
    throw new HttpError(
      422,
      "UNSUPPORTED_VIDEO_CODEC",
      `The video is ${mp4.video ? mp4.video.format : "missing a video track"}; export it as an H.264 MP4 and upload it again.`,
    );
  }
  if (bytes.byteLength > uploadTypes["video/mp4"].maxBytes) {
    throw tooLarge(uploadTypes["video/mp4"].maxBytes);
  }
  const key = storageKeys.video(id);
  written.push(key);
  await bucket.copy(uploadKey, key, { contentType: "video/mp4", cacheControl: immutable });
  return {
    key,
    kind: "video",
    mimeType: "video/mp4",
    size: bytes.byteLength,
    width: mp4.video!.width,
    height: mp4.video!.height,
    durationMs: mp4.durationMs,
    codec: mp4.video!.codec,
    sha256,
    dominantColor: null,
    lqip: null,
    variants: [],
  };
}

function tooLarge(limit: number) {
  return new HttpError(
    422,
    "FILE_TOO_LARGE",
    `The file is larger than ${Math.round(limit / 1024 / 1024)} MB.`,
  );
}

/** Deletes objects without failing the request; a leftover file costs space, not correctness. */
async function removeObjects(keys: string[]): Promise<void> {
  const results = await Promise.allSettled(keys.map((key) => storage().delete(key)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`media: could not delete ${keys[index]}`, result.reason);
    }
  });
}

/**
 * Turns an upload into a library item: checks and processes the file, stores
 * the original privately and the variants publicly, then records the row and
 * its audit entry in one transaction. The upload is removed either way.
 */
export async function createMedia(
  db: Executor,
  {
    input,
    user,
    headers,
  }: { input: z.output<typeof mediaCreateSchema>; user: SessionUser; headers: Headers },
): Promise<AdminMedia> {
  const id = randomUUID();
  const written: string[] = [];
  let row: MediaRow;
  try {
    const file = await store(id, input.key, written);
    row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(media)
        .values({
          id,
          ...file,
          source: input.source,
          illustrative: input.source === "generated" || (input.illustrative ?? false),
          decorative: input.decorative,
          alt: input.alt ?? null,
          caption: input.caption ?? null,
          focusX: input.focusX,
          focusY: input.focusY,
          originalName: input.originalName || null,
          uploadedBy: user.id,
        })
        .returning();
      await audit(tx, {
        actorId: user.id,
        action: "media.create",
        entityType: "media",
        entityId: id,
        after: created,
        headers,
      });
      return created!;
    });
  } catch (error) {
    await removeObjects(written);
    // A file that will never be accepted is not kept until the bucket expires it.
    if (error instanceof HttpError && error.code !== "VALIDATION_FAILED") {
      await removeObjects([input.key]);
    }
    throw error;
  }

  await removeObjects([input.key]);
  revalidatePublic(publicTags.media);
  return toAdminMedia(row);
}

/** `%`, `_` and `\` are taken literally in a search. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** An image the public site leaves out until it has Azerbaijani alt text (`toPublicImage`). */
const missingAltWhere = and(
  eq(media.kind, "image"),
  eq(media.decorative, false),
  sql`coalesce(btrim(${media.alt}->>'az'), '') = ''`,
);

/** The library, newest first unless asked otherwise. */
export async function listMedia(
  db: Executor,
  query: z.output<typeof mediaListQuerySchema>,
): Promise<Page<AdminMedia>> {
  const pattern = query.q ? likePattern(query.q) : null;
  const where: SQL | undefined = and(
    query.kind.length ? inArray(media.kind, query.kind) : undefined,
    query.source.length ? inArray(media.source, query.source) : undefined,
    query.ids.length ? inArray(media.id, query.ids) : undefined,
    pattern
      ? or(
          ilike(media.originalName, pattern),
          ...(["alt", "caption"] as const).flatMap((field) =>
            (["az", "en", "ru"] as const).map(
              (locale) => sql`${media[field]}->>${locale} ilike ${pattern}`,
            ),
          ),
        )
      : undefined,
    query.missingAlt === true ? missingAltWhere : undefined,
    query.missingAlt === false ? sql`not (${missingAltWhere})` : undefined,
  );
  const order = query.sort.direction === "asc" ? asc : desc;
  const [rows, [totals]] = await Promise.all([
    db
      .select()
      .from(media)
      .where(where)
      .orderBy(order(media.createdAt), order(media.id))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(media).where(where),
  ]);
  return toPage(await toAdminMediaList(db, rows), totals?.total ?? 0, query);
}

export async function getMedia(db: Executor, id: string): Promise<AdminMediaDetail> {
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row) throw notFound("No such file.");
  const [item] = await toAdminMediaList(db, [row]);
  return { ...item!, usages: await mediaUsages(db, id) };
}

/**
 * Alt text, caption, focus point, source, flags and a video's poster. A
 * generated image stays illustrative: asking otherwise is refused, and
 * switching an image to `generated` turns the flag on. A poster must be an
 * image in the library, and only a video has one.
 */
export async function updateMedia(
  db: Executor,
  {
    id,
    input,
    user,
    headers,
  }: { id: string; input: z.output<typeof mediaUpdateSchema>; user: SessionUser; headers: Headers },
): Promise<AdminMedia> {
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(media).where(eq(media.id, id)).for("update");
    if (!before) throw notFound("No such file.");

    const source = input.source ?? before.source;
    if (source === "generated" && input.illustrative === false) {
      throw invalidField("illustrative", "A generated image is always illustrative.");
    }
    let poster: MediaRow | undefined;
    if (input.posterMediaId) {
      if (before.kind !== "video") {
        throw invalidField("posterMediaId", "Only a video has a poster.");
      }
      // Shared lock: the poster cannot be deleted while it is being linked.
      [poster] = await tx
        .select()
        .from(media)
        .where(eq(media.id, input.posterMediaId))
        .for("share");
      if (!poster || poster.kind !== "image") {
        throw invalidField("posterMediaId", "The poster must be an image in the library.");
      }
    }
    const [after] = await tx
      .update(media)
      .set({
        ...input,
        ...(source === "generated" ? { illustrative: true } : {}),
      })
      .where(eq(media.id, id))
      .returning();

    await audit(tx, {
      actorId: user.id,
      action: "media.update",
      entityType: "media",
      entityId: id,
      before,
      after,
      headers,
    });
    return { after: after!, poster };
  });

  revalidatePublic(publicTags.media);
  if (result.after.posterMediaId && !result.poster) {
    const [item] = await toAdminMediaList(db, [result.after]);
    return item!;
  }
  return toAdminMedia(result.after, result.poster);
}

/**
 * Removes a file nothing uses: the row (audited), then its stored objects.
 * A file in use is refused with every place it is used.
 */
export async function deleteMedia(
  db: Executor,
  { id, user, headers }: { id: string; user: SessionUser; headers: Headers },
): Promise<void> {
  const removed = await db.transaction(async (tx) => {
    // The row lock also holds back a concurrent write that would start using it.
    const [before] = await tx.select().from(media).where(eq(media.id, id)).for("update");
    if (!before) throw notFound("No such file.");

    const usages = await mediaUsages(tx, id);
    if (usages.length) {
      throw new HttpError(
        409,
        "MEDIA_IN_USE",
        "The file is in use. Remove it from these places first.",
        undefined,
        { usages },
      );
    }

    await tx.delete(media).where(eq(media.id, id));
    await audit(tx, {
      actorId: user.id,
      action: "media.delete",
      entityType: "media",
      entityId: id,
      before,
      headers,
    });
    return before;
  });

  await removeObjects([removed.key, ...removed.variants.map((variant) => variant.key)]);
  revalidatePublic(publicTags.media);
}
