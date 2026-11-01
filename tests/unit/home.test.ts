import { afterEach, describe, expect, it, vi } from "vitest";

import * as seed from "@/db/seed/data";
import { formatPercent, unitSymbol } from "@/i18n/format";
import { groupLayouts } from "@/lib/public/layouts";
import { mediaUrl, toPublicImage, toPublicVideo } from "@/lib/public/media";

const NBSP = "\u00a0";

describe("groupLayouts", () => {
  it("makes one card per room count with the area range of its plans", () => {
    const layouts = seed.layouts.map((layout) => ({ ...layout, planMediaId: null }));
    expect(groupLayouts(layouts, () => null)).toEqual([
      { rooms: 1, areaMin: 62.09, areaMax: 62.09, plans: 1, image: null },
      { rooms: 2, areaMin: 74.4, areaMax: 102.17, plans: 2, image: null },
      { rooms: 3, areaMin: 104.33, areaMax: 121.92, plans: 4, image: null },
      { rooms: 4, areaMin: 142.79, areaMax: 186.9, plans: 3, image: null },
    ]);
  });

  it("uses the first plan of a group that has an image", () => {
    const image = {
      src: "x",
      width: 1,
      height: 1,
      alt: "",
      position: "50% 50%",
      blurDataURL: null,
      illustrative: false,
    };
    const groups = groupLayouts(
      [
        { rooms: 2, areaTotal: "74.40", planMediaId: null },
        { rooms: 2, areaTotal: "102.17", planMediaId: "plan" },
      ],
      (id) => (id === "plan" ? image : null),
    );
    expect(groups[0]?.image).toBe(image);
  });
});

describe("media", () => {
  afterEach(() => vi.unstubAllEnvs());

  const row = {
    id: "1",
    key: "home/hero poster.jpg",
    kind: "image" as const,
    source: "generated" as const,
    mimeType: "image/jpeg",
    size: 10,
    width: 1600,
    height: 900,
    durationMs: null,
    sha256: null,
    alt: { az: "Dağlar", en: "Mountains" },
    caption: null,
    focusX: 0.25,
    focusY: 0.6,
    lqip: null,
    uploadedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("builds public URLs from the bucket origin, encoding each segment", () => {
    vi.stubEnv("S3_PUBLIC_URL", "http://localhost:9010/kalbajar/");
    expect(mediaUrl("home/hero poster.jpg")).toBe(
      "http://localhost:9010/kalbajar/home/hero%20poster.jpg",
    );
    vi.stubEnv("S3_PUBLIC_URL", "");
    expect(mediaUrl("a.jpg")).toBeNull();
  });

  it("resolves an image with its focus point, alt per locale and the illustrative flag", () => {
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.example");
    expect(toPublicImage(row, "en")).toMatchObject({
      src: "https://cdn.example/home/hero%20poster.jpg",
      alt: "Mountains",
      position: "25% 60%",
      illustrative: true,
    });
    expect(toPublicImage(row, "ru")?.alt).toBe("Dağlar");
    expect(toPublicImage({ ...row, width: null }, "az")).toBeNull();
    expect(toPublicVideo(row)).toBeNull();
    expect(toPublicVideo({ ...row, kind: "video", mimeType: "video/mp4" })).toEqual({
      src: "https://cdn.example/home/hero%20poster.jpg",
      type: "video/mp4",
    });
  });
});

describe("home formatting", () => {
  it("formats percentages and unit symbols per locale", () => {
    expect(formatPercent(40, "az")).toBe("40%");
    expect(formatPercent(40, "ru")).toBe(`40${NBSP}%`);
    expect(unitSymbol("m2", "ru")).toBe("м²");
    expect(unitSymbol("ha", "ru")).toBe("га");
  });
});
