// Encodes the bundled default images (spec §8, `src/content/defaults/`).
//
//   pnpm defaults:encode               every slot
//   pnpm defaults:encode home.hero.poster page.elaqe   only these
//
// Reads the originals from DEFAULTS_ORIGINALS (default assets/defaults/originals,
// committed so anyone can re-encode), crops each to its slot's aspect ratio around its focus
// point, and writes public/defaults/<slot>/<width>.<avif|webp> at the widths
// the media library would make (`planVariantWidths`), with the library's own
// encoder settings. Sizes, the blur placeholder and the dominant colour go to
// src/content/defaults/encoded.json. To replace a default, put the new
// original in the folder, point the slot's manifest entry at it and run this.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { format as prettier } from "prettier";
import sharp from "sharp";

import {
  defaultEntries,
  defaultSlots,
  type DefaultEntry,
  type DefaultSlot,
} from "../src/content/defaults/manifest";
import { encoders } from "../src/lib/media/image";
import { planVariantWidths } from "../src/shared/media";

const originals = process.env.DEFAULTS_ORIGINALS ?? "assets/defaults/originals";
const publicDir = "public/defaults";
const manifestFile = "src/content/defaults/encoded.json";

const requested = process.argv.slice(2);
const unknown = requested.filter((slot) => !(defaultSlots as readonly string[]).includes(slot));
if (unknown.length) throw new Error(`Unknown slots: ${unknown.join(", ")}`);
const slots = requested.length ? (requested as DefaultSlot[]) : [...defaultSlots];

type Encoded = {
  width: number;
  height: number;
  widths: number[];
  position: string;
  lqip: string;
  dominantColor: string;
};

const previous: Partial<Record<DefaultSlot, Encoded>> = existsSync(manifestFile)
  ? JSON.parse(readFileSync(manifestFile, "utf8"))
  : {};

/** The largest box of the entry's aspect ratio inside `within`, centred on the focus point. */
function cropBox(entry: DefaultEntry, width: number, height: number) {
  const [l, t, r, b] = entry.within ?? [0, 0, 1, 1];
  const region = {
    left: l * width,
    top: t * height,
    width: (r - l) * width,
    height: (b - t) * height,
  };
  const w = Math.floor(Math.min(region.width, region.height * entry.aspect));
  const h = Math.floor(w / entry.aspect);
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const left = Math.round(
    clamp(entry.focus.x * width - w / 2, region.left, region.left + region.width - w),
  );
  const top = Math.round(
    clamp(entry.focus.y * height - h / 2, region.top, region.top + region.height - h),
  );
  return { left, top, width: w, height: h };
}

const percent = (value: number) => `${Math.round(Math.min(Math.max(value, 0), 1) * 10000) / 100}%`;

async function encode(slot: DefaultSlot): Promise<Encoded> {
  const entry = defaultEntries[slot];
  const path = join(originals, entry.original);
  if (!existsSync(path)) throw new Error(`${slot}: original ${path} is missing`);

  const input = sharp(readFileSync(path), { autoOrient: true });
  const meta = await input.metadata();
  const box = cropBox(entry, meta.autoOrient.width, meta.autoOrient.height);
  const crop = await sharp(readFileSync(path), { autoOrient: true })
    .extract(box)
    .toColourspace("srgb")
    .png()
    .toBuffer();

  const widths = planVariantWidths(Math.min(box.width, entry.maxWidth ?? box.width));
  const largest = widths[widths.length - 1]!;
  const dir = join(publicDir, slot);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  let height = 0;
  for (const width of widths) {
    for (const format of ["avif", "webp"] as const) {
      const { data, info } = await encoders[format](sharp(crop).resize({ width })).toBuffer({
        resolveWithObject: true,
      });
      writeFileSync(join(dir, `${width}.${format}`), data);
      if (width === largest) height = info.height;
    }
  }

  const [stats, lqip] = await Promise.all([
    sharp(crop).stats(),
    sharp(crop)
      .resize({ width: 16, height: 16, fit: "inside" })
      .webp({ quality: 40, alphaQuality: 40 })
      .toBuffer(),
  ]);
  const { r, g, b } = stats.dominant;
  const position = `${percent((entry.focus.x * meta.autoOrient.width - box.left) / box.width)} ${percent(
    (entry.focus.y * meta.autoOrient.height - box.top) / box.height,
  )}`;
  return {
    width: largest,
    height,
    widths,
    position,
    lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
    dominantColor: `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
  };
}

const result: Partial<Record<DefaultSlot, Encoded>> = {};
for (const slot of defaultSlots) {
  if (slots.includes(slot)) {
    result[slot] = await encode(slot);
    console.log(`${slot}: ${result[slot].widths.join(", ")} px`);
  } else if (previous[slot]) {
    result[slot] = previous[slot];
  }
}

writeFileSync(
  manifestFile,
  await prettier(JSON.stringify(result), { parser: "json", filepath: manifestFile }),
);
console.log(`wrote ${manifestFile}`);
