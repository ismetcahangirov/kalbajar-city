/**
 * Tiny MP4 files built box by box, for the parser (#11). They hold no media
 * data: the parser reads only the box tree.
 */

type Part = Uint8Array | number[];

function bytes(...parts: Part[]): Uint8Array {
  const arrays = parts.map((part) => (part instanceof Uint8Array ? part : Uint8Array.from(part)));
  const out = new Uint8Array(arrays.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const u16 = (value: number) => [(value >> 8) & 0xff, value & 0xff];
const u32 = (value: number) => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];
const u64 = (value: number) => [...u32(Math.floor(value / 2 ** 32)), ...u32(value >>> 0)];
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const zeros = (count: number) => new Array<number>(count).fill(0);

export function box(type: string, ...payload: Part[]): Uint8Array {
  const body = bytes(...payload);
  return bytes(u32(body.length + 8), ascii(type), body);
}

/** A box whose size is in the 64-bit `largesize` field. */
export function largeBox(type: string, ...payload: Part[]): Uint8Array {
  const body = bytes(...payload);
  return bytes(u32(1), ascii(type), u64(body.length + 16), body);
}

export const ftyp = (brand = "isom") =>
  box("ftyp", ascii(brand), u32(512), ascii("isom"), ascii("avc1"));

export function mvhd({ version = 0, timescale = 1000, duration = 0 } = {}) {
  return version === 1
    ? box("mvhd", [1, 0, 0, 0], u64(0), u64(0), u32(timescale), u64(duration), zeros(80))
    : box("mvhd", [0, 0, 0, 0], u32(0), u32(0), u32(timescale), u32(duration), zeros(80));
}

const hdlr = (handler: string) => box("hdlr", [0, 0, 0, 0], u32(0), ascii(handler), zeros(12), [0]);

/** A visual sample entry: 6 reserved, data reference index, 16 pre-defined, size, 50 more. */
function visualEntry(format: string, width: number, height: number, ...children: Part[]) {
  return box(format, zeros(6), u16(1), zeros(16), u16(width), u16(height), zeros(50), ...children);
}

export const avcC = (profile: number, compatibility: number, level: number) =>
  box("avcC", [1, profile, compatibility, level, 0xff, 0xe1]);

function trak(handler: string, entry: Uint8Array) {
  const stsd = box("stsd", [0, 0, 0, 0], u32(1), entry);
  return box("trak", box("mdia", hdlr(handler), box("minf", box("stbl", stsd))));
}

export function videoTrak(format: string, width: number, height: number, ...children: Part[]) {
  return trak("vide", visualEntry(format, width, height, ...children));
}

export const audioTrak = () => trak("soun", box("mp4a", zeros(28)));

export function mp4({
  brand = "isom",
  tracks = [] as Uint8Array[],
  movieHeader = mvhd({ duration: 12_345 }),
}: { brand?: string; tracks?: Uint8Array[]; movieHeader?: Uint8Array } = {}) {
  return bytes(ftyp(brand), box("moov", movieHeader, ...tracks), box("mdat", zeros(16)));
}

/** A 1080p H.264 (High, level 4.0) file with an AAC track, 12.345 s long. */
export const h264Mp4 = () =>
  mp4({ tracks: [audioTrak(), videoTrak("avc1", 1920, 1080, avcC(0x64, 0x00, 0x28))] });

/** The same file as HEVC, which the site does not accept. */
export const hevcMp4 = () => mp4({ tracks: [videoTrak("hvc1", 3840, 2160)] });
