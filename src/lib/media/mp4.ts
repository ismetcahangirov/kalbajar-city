/**
 * Reads what the media library needs from an MP4 file's box tree (ISO/IEC
 * 14496-12), in TypeScript: the production container has no ffmpeg (#11).
 * It reads, it never decodes: brand, duration, and the video track's sample
 * entry (codec, width, height).
 */

export type Mp4Info = {
  /** `ftyp`'s major brand, e.g. `isom`. */
  brand: string;
  durationMs: number;
  /** The first video track; null when the file has none. */
  video: {
    /** The sample entry type: `avc1` for H.264, `hvc1`/`hev1`, `av01`, `vp09`… */
    format: string;
    /** An RFC 6381 codec string for H.264 (`avc1.640028`), else the format. */
    codec: string;
    width: number;
    height: number;
  } | null;
};

type Box = { type: string; start: number; end: number; body: number };

/** H.264 sample entries; both play wherever H.264 MP4 does. */
const h264 = new Set(["avc1", "avc3"]);

export function isH264(info: Mp4Info): boolean {
  return !!info.video && h264.has(info.video.format);
}

/**
 * Parses an MP4. Returns null for anything that is not one: no leading
 * `ftyp`, a QuickTime movie, a box that overruns the file, no `moov`.
 */
export function parseMp4(bytes: Uint8Array): Mp4Info | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    const top = children(view, 0, bytes.byteLength);
    const ftyp = top[0];
    if (!ftyp || ftyp.type !== "ftyp" || ftyp.end - ftyp.body < 8) return null;
    const brand = fourcc(view, ftyp.body);
    // QuickTime (.mov) shares the box format but is not MP4.
    if (brand === "qt  ") return null;

    const moov = top.find((box) => box.type === "moov");
    if (!moov) return null;
    const boxes = children(view, moov.body, moov.end);

    const mvhd = boxes.find((box) => box.type === "mvhd");
    const durationMs = mvhd ? movieDuration(view, mvhd) : 0;

    let video: Mp4Info["video"] = null;
    for (const trak of boxes.filter((box) => box.type === "trak")) {
      const mdia = child(view, trak, "mdia");
      const hdlr = mdia && child(view, mdia, "hdlr");
      // hdlr: version/flags (4), pre_defined (4), handler_type (4).
      if (!hdlr || fourcc(view, hdlr.body + 8) !== "vide") continue;
      const stbl = path(view, mdia, ["minf", "stbl"]);
      const stsd = stbl && child(view, stbl, "stsd");
      if (!stsd) continue;
      // stsd: version/flags (4), entry_count (4), then sample entries.
      const [entry] = children(view, stsd.body + 8, stsd.end);
      if (!entry) continue;
      video = sampleEntry(view, entry);
      break;
    }

    return { brand, durationMs, video };
  } catch (error) {
    if (error instanceof RangeError || error instanceof Malformed) return null;
    throw error;
  }
}

class Malformed extends Error {}

function fourcc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** The boxes directly inside `[start, end)`. */
function children(view: DataView, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = fourcc(view, offset + 4);
    let body = offset + 8;
    if (size === 1) {
      const large = view.getBigUint64(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) throw new Malformed();
      size = Number(large);
      body = offset + 16;
    } else if (size === 0) {
      size = end - offset;
    }
    const boxEnd = offset + size;
    if (size < body - offset || boxEnd > end) throw new Malformed();
    boxes.push({ type, start: offset, end: boxEnd, body });
    offset = boxEnd;
  }
  return boxes;
}

function child(view: DataView, parent: Box, type: string): Box | undefined {
  return children(view, parent.body, parent.end).find((box) => box.type === type);
}

function path(view: DataView, parent: Box, types: string[]): Box | undefined {
  let current: Box | undefined = parent;
  for (const type of types) current = current && child(view, current, type);
  return current;
}

/** mvhd: version 0 has 32-bit times, version 1 64-bit. */
function movieDuration(view: DataView, mvhd: Box): number {
  const version = view.getUint8(mvhd.body);
  const timescale = version === 1 ? view.getUint32(mvhd.body + 20) : view.getUint32(mvhd.body + 12);
  const duration =
    version === 1 ? Number(view.getBigUint64(mvhd.body + 24)) : view.getUint32(mvhd.body + 16);
  return timescale ? Math.round((duration / timescale) * 1000) : 0;
}

/**
 * A visual sample entry: reserved (6), data_reference_index (2),
 * pre_defined/reserved (16), width (2), height (2), then 50 bytes to its
 * child boxes (`avcC` for H.264).
 */
function sampleEntry(view: DataView, entry: Box): NonNullable<Mp4Info["video"]> {
  const format = entry.type;
  const width = view.getUint16(entry.body + 24);
  const height = view.getUint16(entry.body + 26);
  let codec = format;
  if (h264.has(format)) {
    const avcC = children(view, entry.body + 78, entry.end).find((box) => box.type === "avcC");
    // avcC: configurationVersion, AVCProfileIndication, profile_compatibility, AVCLevelIndication.
    if (avcC && avcC.end - avcC.body >= 4) {
      const hex = (offset: number) =>
        view
          .getUint8(avcC.body + offset)
          .toString(16)
          .padStart(2, "0");
      codec = `${format}.${hex(1)}${hex(2)}${hex(3)}`;
    }
  }
  return { format, codec, width, height };
}
