import sharp, { type Sharp } from "sharp";

import { planVariantWidths, type UploadMimeType, type VariantFormat } from "@/shared/media";

/** Image formats the library accepts, as found in the bytes. */
export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

export type ImageProbe = { format: ImageFormat; width: number; height: number };

export type ProcessedImage = {
  /** After EXIF rotation. */
  width: number;
  height: number;
  /** `#rrggbb`. */
  dominantColor: string;
  /** A tiny WebP as a data URL. */
  lqip: string;
  outputs: Array<{ format: VariantFormat; width: number; height: number; body: Uint8Array }>;
};

/** Larger than any photo or render the site needs (12 000 × 10 000), small enough to decode safely. */
const maxPixels = 120_000_000;

const encoders = {
  avif: (image: Sharp) => image.avif({ quality: 50, effort: 4 }),
  webp: (image: Sharp) => image.webp({ quality: 74, effort: 4 }),
} satisfies Record<VariantFormat, (image: Sharp) => Sharp>;

export const imageMimeTypes = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const satisfies Record<ImageFormat, UploadMimeType>;

/**
 * What the bytes really are, whatever the uploader declared. Null for
 * anything that is not a JPEG, PNG, WebP or AVIF image sharp can read.
 */
export async function probeImage(bytes: Uint8Array): Promise<ImageProbe | null> {
  try {
    const meta = await sharp(bytes, { limitInputPixels: maxPixels }).metadata();
    const format =
      meta.format === "heif"
        ? meta.compression === "av1"
          ? "avif"
          : null
        : meta.format === "jpeg" || meta.format === "png" || meta.format === "webp"
          ? meta.format
          : null;
    const { width, height } = meta.autoOrient;
    if (!format || !width || !height) return null;
    // An animated WebP or AVIF has more than one page; the site shows stills.
    if ((meta.pages ?? 1) > 1) return null;
    return { format, width, height };
  } catch {
    return null;
  }
}

/**
 * Rotates by EXIF, drops all metadata (location included), and makes the
 * AVIF and WebP variants, the dominant colour and the blur placeholder.
 */
export async function processImage(bytes: Uint8Array): Promise<ProcessedImage> {
  const input = () => sharp(bytes, { limitInputPixels: maxPixels, autoOrient: true });

  // One decode and downscale to the largest variant; every output starts from it.
  const meta = await input().metadata();
  const width = meta.autoOrient.width;
  const height = meta.autoOrient.height;
  const widths = planVariantWidths(width);
  const largest = widths[widths.length - 1]!;
  const master = await input()
    .resize({ width: largest, withoutEnlargement: true })
    .toColourspace("srgb")
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true });
  const fromMaster = () =>
    sharp(master.data, {
      raw: {
        width: master.info.width,
        height: master.info.height,
        channels: master.info.channels,
      },
    });

  const [stats, lqip, ...outputs] = await Promise.all([
    fromMaster().stats(),
    fromMaster()
      .resize({ width: 16, height: 16, fit: "inside" })
      .webp({ quality: 40, alphaQuality: 40 })
      .toBuffer(),
    ...widths.flatMap((target) =>
      (["avif", "webp"] as const).map(async (format) => {
        const { data, info } = await encoders[format](
          fromMaster().resize({ width: target }),
        ).toBuffer({ resolveWithObject: true });
        return { format, width: info.width, height: info.height, body: new Uint8Array(data) };
      }),
    ),
  ]);

  const { r, g, b } = stats.dominant;
  return {
    width,
    height,
    dominantColor: `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
    lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
    outputs,
  };
}
