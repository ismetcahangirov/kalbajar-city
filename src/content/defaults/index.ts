import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";
import type { Locale } from "@/i18n/routing";
import type { PublicImage, PublicImageSource } from "@/lib/public/media";
import type { VariantFormat } from "@/shared/media";

import encoded from "./encoded.json";
import {
  defaultEntries,
  defaultSlots,
  type DefaultEntry,
  type DefaultSlot,
  type DefaultSource,
} from "./manifest";

export { defaultSlots, type DefaultSlot, type DefaultSource };

/** What `pnpm defaults:encode` measured and wrote for one slot. */
export type EncodedDefault = {
  /** Of the crop, at its widest encoded width. */
  width: number;
  height: number;
  /** Every width written, narrowest first, each as AVIF and WebP. */
  widths: number[];
  /** `object-position` inside the crop. */
  position: string;
  lqip: string;
  dominantColor: string;
};

/** A slot's bundled default: the manifest entry with its encoded files. */
export type DefaultImage = Pick<DefaultEntry, "focus" | "source" | "ref" | "date"> &
  EncodedDefault & {
    slot: DefaultSlot;
    decorative: boolean;
    /** Generated defaults are always shown with the "Illustrative" chip. */
    illustrative: boolean;
    /** `Defaults.<slot>` in the message catalogues; null for a decorative image. */
    altKey: string | null;
  };

const files = encoded as Partial<Record<DefaultSlot, EncodedDefault>>;

export const defaults = Object.fromEntries(
  defaultSlots.map((slot) => {
    const entry = defaultEntries[slot];
    const file = files[slot];
    if (!file)
      throw new Error(`No encoded files for the default "${slot}": run pnpm defaults:encode`);
    const decorative = entry.decorative ?? false;
    const image: DefaultImage = {
      ...file,
      slot,
      focus: entry.focus,
      source: entry.source,
      ref: entry.ref,
      date: entry.date,
      decorative,
      illustrative: entry.source === "generated",
      altKey: decorative ? null : `Defaults.${slot}`,
    };
    return [slot, image];
  }),
) as Record<DefaultSlot, DefaultImage>;

/** The public path of one encoded file. */
export function defaultFileUrl(slot: DefaultSlot, width: number, format: VariantFormat): string {
  return `/defaults/${slot}/${width}.${format}`;
}

/** The fallback `<img src>`, as for library images: the widest WebP up to 1600 px. */
const fallbackWidth = 1600;

const catalogues = { az, en, ru } as const;

/**
 * The slot's alt text in `locale`: `Defaults.<slot>` in the message
 * catalogue. The catalogues are read directly so cached loaders, which run
 * outside a request, can use it.
 */
export function defaultAlt(slot: DefaultSlot, locale: Locale): string {
  if (defaults[slot].decorative) return "";
  let node: unknown = catalogues[locale].Defaults;
  for (const part of slot.split(".")) {
    node = node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === "string" ? node : "";
}

/**
 * The slot's default as pages render images: the same shape as a library
 * image, so a component cannot tell the two apart.
 */
export function defaultImage(slot: DefaultSlot, locale: Locale): PublicImage {
  const image = defaults[slot];
  const sources = (["avif", "webp"] as const).map((format): PublicImageSource => ({
    type: `image/${format}`,
    srcSet: image.widths
      .map((width) => `${defaultFileUrl(slot, width, format)} ${width}w`)
      .join(", "),
  }));
  const fallback =
    image.widths.filter((width) => width <= fallbackWidth).at(-1) ?? image.widths[0]!;
  return {
    src: defaultFileUrl(slot, fallback, "webp"),
    width: image.width,
    height: image.height,
    alt: defaultAlt(slot, locale),
    position: image.position,
    blurDataURL: image.lqip,
    dominantColor: image.dominantColor,
    sources,
    illustrative: image.illustrative,
  };
}
