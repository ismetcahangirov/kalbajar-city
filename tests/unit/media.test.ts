import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { can } from "@/lib/auth/permissions";
import { probeImage, processImage } from "@/lib/media/image";
import { isH264, parseMp4 } from "@/lib/media/mp4";
import { jsonPaths } from "@/lib/media/usages";
import { toPublicImage } from "@/lib/public/media";
import {
  mediaUpdateSchema,
  planVariantWidths,
  uploadRequestSchema,
  type MediaVariant,
} from "@/shared/media";

import {
  audioTrak,
  avcC,
  box,
  h264Mp4,
  hevcMp4,
  largeBox,
  mp4,
  mvhd,
  videoTrak,
} from "../fixtures/mp4";

describe("planVariantWidths", () => {
  it("makes every standard width below the original and never upscales", () => {
    expect(planVariantWidths(6000)).toEqual([480, 960, 1600, 2400]);
    expect(planVariantWidths(2400)).toEqual([480, 960, 1600, 2400]);
    expect(planVariantWidths(2000)).toEqual([480, 960, 1600, 2000]);
    expect(planVariantWidths(960)).toEqual([480, 960]);
    expect(planVariantWidths(300)).toEqual([300]);
  });
});

describe("parseMp4", () => {
  it("reads an H.264 track's codec, size and the movie's duration", () => {
    const info = parseMp4(h264Mp4());
    expect(info).toEqual({
      brand: "isom",
      durationMs: 12_345,
      video: { format: "avc1", codec: "avc1.640028", width: 1920, height: 1080 },
    });
    expect(isH264(info!)).toBe(true);
  });

  it("recognises HEVC as not H.264", () => {
    const info = parseMp4(hevcMp4());
    expect(info?.video).toMatchObject({ format: "hvc1", width: 3840, height: 2160 });
    expect(isH264(info!)).toBe(false);
  });

  it("reads 64-bit times and box sizes", () => {
    const file = mp4({
      movieHeader: mvhd({ version: 1, timescale: 90_000, duration: 90_000 * 3 }),
      tracks: [videoTrak("avc1", 1280, 720, avcC(0x42, 0xc0, 0x1e))],
    });
    expect(parseMp4(file)).toMatchObject({ durationMs: 3000, video: { codec: "avc1.42c01e" } });

    const large = Uint8Array.from([
      ...box("ftyp", [0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]),
      ...largeBox("moov", mvhd({ duration: 500 })),
    ]);
    expect(parseMp4(large)).toEqual({ brand: "isom", durationMs: 500, video: null });
  });

  it("finds no video in an audio-only file", () => {
    const info = parseMp4(mp4({ tracks: [audioTrak()] }));
    expect(info?.video).toBeNull();
    expect(isH264(info!)).toBe(false);
  });

  it("refuses what is not an MP4", () => {
    expect(parseMp4(new TextEncoder().encode("not a video at all"))).toBeNull();
    expect(parseMp4(new Uint8Array())).toBeNull();
    // QuickTime shares the box format.
    expect(parseMp4(mp4({ brand: "qt  ", tracks: [videoTrak("avc1", 640, 480)] }))).toBeNull();
    // No moov.
    expect(parseMp4(box("ftyp", [0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]))).toBeNull();
    // A box that claims more bytes than the file has.
    expect(parseMp4(h264Mp4().slice(0, 100))).toBeNull();
  });
});

describe("the image pipeline", () => {
  /** A JPEG `width` × `height` stored on its side, with EXIF orientation 6 (rotate 90°). */
  async function sideways(width: number, height: number) {
    return sharp({ create: { width: height, height: width, channels: 3, background: "#7a8c6b" } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "secret" } } })
      .toBuffer();
  }

  it("rotates by EXIF, never upscales, and strips metadata", async () => {
    const result = await processImage(await sideways(1000, 600));
    expect(result).toMatchObject({ width: 1000, height: 600 });
    expect(result.outputs.map((output) => [output.format, output.width, output.height])).toEqual([
      ["avif", 480, 288],
      ["webp", 480, 288],
      ["avif", 960, 576],
      ["webp", 960, 576],
      ["avif", 1000, 600],
      ["webp", 1000, 600],
    ]);
    for (const output of result.outputs) {
      const meta = await sharp(output.body).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
    expect(result.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.lqip).toMatch(/^data:image\/webp;base64,/);
    expect(result.lqip.length).toBeLessThan(400);
  });

  it("identifies images by their bytes", async () => {
    const png = await sharp({
      create: { width: 20, height: 10, channels: 4, background: "#00000000" },
    })
      .png()
      .toBuffer();
    expect(await probeImage(png)).toEqual({ format: "png", width: 20, height: 10 });
    expect(await probeImage(await sideways(40, 30))).toEqual({
      format: "jpeg",
      width: 40,
      height: 30,
    });
    expect(await probeImage(h264Mp4())).toBeNull();
    expect(await probeImage(new TextEncoder().encode("<svg/>"))).toBeNull();
  });
});

describe("toPublicImage", () => {
  afterEach(() => vi.unstubAllEnvs());

  const variant = (format: "avif" | "webp", width: number): MediaVariant => ({
    format,
    width,
    height: Math.round((width * 2) / 3),
    key: `media/m1/${width}.${format}`,
    size: 1000,
  });

  const row = {
    id: "m1",
    key: "originals/m1.jpg",
    kind: "image" as const,
    source: "owner" as const,
    mimeType: "image/jpeg",
    size: 10,
    width: 6000,
    height: 4000,
    durationMs: null,
    sha256: null,
    alt: { az: "Dağlar", en: "Mountains" },
    caption: null,
    focusX: 0.5,
    focusY: 0.5,
    lqip: "data:image/webp;base64,AAAA",
    illustrative: false,
    decorative: false,
    dominantColor: "#405060",
    // Out of order on purpose.
    variants: [2400, 480, 1600, 960].flatMap((width) => [
      variant("webp", width),
      variant("avif", width),
    ]),
    codec: null,
    uploadedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("offers AVIF then WebP candidates by width, with a mid-sized WebP fallback", () => {
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.example");
    const image = toPublicImage(row, "en");
    expect(image).toMatchObject({
      src: "https://cdn.example/media/m1/1600.webp",
      width: 6000,
      height: 4000,
      alt: "Mountains",
      blurDataURL: row.lqip,
      dominantColor: "#405060",
      illustrative: false,
    });
    expect(image?.sources).toEqual([
      {
        type: "image/avif",
        srcSet: [480, 960, 1600, 2400]
          .map((width) => `https://cdn.example/media/m1/${width}.avif ${width}w`)
          .join(", "),
      },
      {
        type: "image/webp",
        srcSet: [480, 960, 1600, 2400]
          .map((width) => `https://cdn.example/media/m1/${width}.webp ${width}w`)
          .join(", "),
      },
    ]);
  });

  it("is never shown without alt text unless decorative", () => {
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.example");
    expect(toPublicImage({ ...row, alt: null }, "az")).toBeNull();
    expect(toPublicImage({ ...row, alt: { az: "  " } }, "az")).toBeNull();
    expect(toPublicImage({ ...row, alt: null, decorative: true }, "az")?.alt).toBe("");
    expect(toPublicImage({ ...row, decorative: true }, "en")?.alt).toBe("");
  });

  it("marks generated images illustrative", () => {
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.example");
    expect(toPublicImage({ ...row, source: "generated" }, "az")?.illustrative).toBe(true);
    expect(toPublicImage({ ...row, illustrative: true }, "az")?.illustrative).toBe(true);
  });

  it("falls back to the stored file for a row without variants", () => {
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.example");
    const image = toPublicImage({ ...row, key: "home/old.jpg", variants: [] }, "az");
    expect(image).toMatchObject({ src: "https://cdn.example/home/old.jpg", sources: [] });
  });
});

describe("media schemas", () => {
  it("limits uploads by type and size", () => {
    const mb = 1024 * 1024;
    const ok = (mimeType: string, size: number) =>
      uploadRequestSchema.safeParse({ filename: "f", mimeType, size }).success;
    expect(ok("image/jpeg", 40 * mb)).toBe(true);
    expect(ok("image/jpeg", 40 * mb + 1)).toBe(false);
    expect(ok("video/mp4", 80 * mb)).toBe(true);
    expect(ok("video/mp4", 80 * mb + 1)).toBe(false);
    expect(ok("image/gif", 10)).toBe(false);
    expect(ok("video/quicktime", 10)).toBe(false);
  });

  it("refuses an empty update", () => {
    expect(mediaUpdateSchema.safeParse({}).success).toBe(false);
    expect(mediaUpdateSchema.safeParse({ focusX: 0.2 }).success).toBe(true);
    expect(mediaUpdateSchema.safeParse({ focusX: 1.2 }).success).toBe(false);
  });
});

describe("jsonPaths", () => {
  it("finds every place an id appears in home section content", () => {
    const id = "6f1c2b9e-0000-4000-8000-000000000001";
    expect(
      jsonPaths(
        { title: { az: id }, posterMediaId: id, items: [{ mediaId: "x" }, { mediaId: id }] },
        id,
      ),
    ).toEqual(["title.az", "posterMediaId", "items.1.mediaId"]);
    expect(jsonPaths({ mediaId: null }, id)).toEqual([]);
  });
});

describe("media permissions", () => {
  it("lets editors and admins manage media, not sales", () => {
    for (const role of ["owner", "admin", "editor"] as const) {
      expect(can(role, { media: ["read", "upload", "update", "delete"] })).toBe(true);
    }
    expect(can("sales", { media: ["upload"] })).toBe(false);
    expect(can("sales", { media: ["read"] })).toBe(false);
  });
});
