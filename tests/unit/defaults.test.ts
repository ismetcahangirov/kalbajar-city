import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultAlt,
  defaultFileUrl,
  defaultImage,
  defaults,
  defaultSlots,
} from "@/content/defaults";
import { defaultEntries } from "@/content/defaults/manifest";
import { locales } from "@/i18n/routing";
import { planVariantWidths, variantFormats } from "@/shared/media";

const file = (url: string) => join("public", url);

describe("default images", () => {
  it("cover every slot with its encoded files, at every width and format", () => {
    for (const slot of defaultSlots) {
      const image = defaults[slot];
      expect(image.widths.length, slot).toBeGreaterThan(0);
      expect(image.width, slot).toBe(image.widths.at(-1));
      for (const width of image.widths) {
        for (const format of variantFormats) {
          expect(existsSync(file(defaultFileUrl(slot, width, format))), `${slot} ${width}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("are made at the widths the media library would make for the crop", () => {
    for (const slot of defaultSlots) {
      const { widths } = defaults[slot];
      expect(widths, slot).toEqual(planVariantWidths(widths.at(-1)!));
    }
  });

  it("are cropped to their slot's aspect ratio", () => {
    for (const slot of defaultSlots) {
      const { width, height } = defaults[slot];
      expect(width / height, slot).toBeCloseTo(defaultEntries[slot].aspect, 1);
    }
  });

  it("have alt text in every locale, unless decorative", () => {
    for (const slot of defaultSlots) {
      for (const locale of locales) {
        const alt = defaultAlt(slot, locale);
        if (defaults[slot].decorative) expect(alt, slot).toBe("");
        else expect(alt.trim().length, `${slot} ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  it("mark every generated image illustrative, and only those", () => {
    for (const slot of defaultSlots) {
      const image = defaults[slot];
      expect(image.illustrative, slot).toBe(image.source === "generated");
      expect(defaultImage(slot, "az").illustrative, slot).toBe(image.source === "generated");
    }
  });

  it("name their source: the Instagram post, or the prompt", () => {
    for (const slot of defaultSlots) {
      const { source, ref } = defaults[slot];
      if (source === "instagram") {
        expect(ref, slot).toMatch(/^https:\/\/www\.instagram\.com\/(p|reel)\/[\w-]+\/$/);
      } else expect(ref, slot).toMatch(/^G\d+$/);
    }
  });

  it("render like a library image: AVIF then WebP, a WebP fallback, the focus point", () => {
    const image = defaultImage("home.hero.poster", "en");
    const { widths } = defaults["home.hero.poster"];
    expect(image.sources.map((source) => source.type)).toEqual(["image/avif", "image/webp"]);
    expect(image.sources[0]?.srcSet).toBe(
      widths.map((width) => `/defaults/home.hero.poster/${width}.avif ${width}w`).join(", "),
    );
    expect(image.src).toMatch(/^\/defaults\/home\.hero\.poster\/\d+\.webp$/);
    expect(image.position).toMatch(/^[\d.]+% [\d.]+%$/);
    expect(image.alt).toBe(defaultAlt("home.hero.poster", "en"));
    expect(image.blurDataURL).toMatch(/^data:image\/webp;base64,/);
  });

  it("stay lean: the widest AVIF under 250 KB, all files under 25 MB", () => {
    let total = 0;
    for (const slot of defaultSlots) {
      const { widths } = defaults[slot];
      for (const width of widths) {
        for (const format of variantFormats) {
          const size = statSync(file(defaultFileUrl(slot, width, format))).size;
          total += size;
          if (format === "avif" && width === widths.at(-1)) {
            expect(size, slot).toBeLessThanOrEqual(250 * 1024);
          }
        }
      }
    }
    expect(total).toBeLessThanOrEqual(25 * 1024 * 1024);
  });
});
