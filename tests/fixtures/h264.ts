/**
 * A small MP4 a browser can really play: H.264 Baseline built by hand from
 * I_PCM macroblocks (raw samples, no prediction or entropy coding), so tests
 * need no encoder. Every frame is an IDR picture. The E2E tests upload it and
 * the console captures a poster frame from it (#25).
 */

class BitWriter {
  readonly bytes: number[] = [];
  private current = 0;
  private count = 0;

  bit(value: number) {
    this.current = (this.current << 1) | (value & 1);
    this.count += 1;
    if (this.count === 8) {
      this.bytes.push(this.current);
      this.current = 0;
      this.count = 0;
    }
  }

  u(value: number, bits: number) {
    for (let index = bits - 1; index >= 0; index -= 1) this.bit((value >> index) & 1);
  }

  /** Unsigned Exp-Golomb. */
  ue(value: number) {
    const coded = value + 1;
    const length = Math.floor(Math.log2(coded));
    for (let index = 0; index < length; index += 1) this.bit(0);
    this.u(coded, length + 1);
  }

  se(value: number) {
    this.ue(value <= 0 ? -2 * value : 2 * value - 1);
  }

  get aligned() {
    return this.count === 0;
  }

  /** `rbsp_trailing_bits`: a one, then zeros to the byte boundary. */
  trailing() {
    this.bit(1);
    while (!this.aligned) this.bit(0);
  }
}

/** A NAL unit: header byte, then the payload with emulation prevention bytes. */
function nal(type: number, payload: number[]): Uint8Array {
  const out = [(3 << 5) | type];
  let zeros = 0;
  for (const byte of payload) {
    if (zeros >= 2 && byte <= 3) {
      out.push(3);
      zeros = 0;
    }
    out.push(byte);
    zeros = byte === 0 ? zeros + 1 : 0;
  }
  return Uint8Array.from(out);
}

const profile = 66; // Baseline
const compatibility = 0xc0; // constraint_set0 and constraint_set1
const level = 30;

function sps(widthMbs: number, heightMbs: number): Uint8Array {
  const bits = new BitWriter();
  bits.u(profile, 8);
  bits.u(compatibility, 8);
  bits.u(level, 8);
  bits.ue(0); // seq_parameter_set_id
  bits.ue(0); // log2_max_frame_num_minus4
  bits.ue(2); // pic_order_cnt_type: output order is decoding order
  bits.ue(0); // max_num_ref_frames
  bits.bit(0); // gaps_in_frame_num_value_allowed_flag
  bits.ue(widthMbs - 1);
  bits.ue(heightMbs - 1);
  bits.bit(1); // frame_mbs_only_flag
  bits.bit(1); // direct_8x8_inference_flag
  bits.bit(0); // frame_cropping_flag
  bits.bit(0); // vui_parameters_present_flag
  bits.trailing();
  return nal(7, bits.bytes);
}

function pps(): Uint8Array {
  const bits = new BitWriter();
  bits.ue(0); // pic_parameter_set_id
  bits.ue(0); // seq_parameter_set_id
  bits.bit(0); // entropy_coding_mode_flag: CAVLC
  bits.bit(0); // bottom_field_pic_order_in_frame_present_flag
  bits.ue(0); // num_slice_groups_minus1
  bits.ue(0); // num_ref_idx_l0_default_active_minus1
  bits.ue(0); // num_ref_idx_l1_default_active_minus1
  bits.bit(0); // weighted_pred_flag
  bits.u(0, 2); // weighted_bipred_idc
  bits.se(0); // pic_init_qp_minus26
  bits.se(0); // pic_init_qs_minus26
  bits.se(0); // chroma_qp_index_offset
  bits.bit(1); // deblocking_filter_control_present_flag
  bits.bit(0); // constrained_intra_pred_flag
  bits.bit(0); // redundant_pic_cnt_present_flag
  bits.trailing();
  return nal(8, bits.bytes);
}

type Sample = (x: number, y: number) => number;

/** One IDR frame of I_PCM macroblocks; samples stay in 16–240, so no byte is zero. */
function frame(
  index: number,
  widthMbs: number,
  heightMbs: number,
  luma: Sample,
  cb: Sample,
  cr: Sample,
): Uint8Array {
  const bits = new BitWriter();
  bits.ue(0); // first_mb_in_slice
  bits.ue(7); // slice_type: I, and every slice of the picture is I
  bits.ue(0); // pic_parameter_set_id
  bits.u(0, 4); // frame_num
  bits.ue(index % 2); // idr_pic_id: consecutive IDR pictures differ
  bits.bit(0); // no_output_of_prior_pics_flag
  bits.bit(0); // long_term_reference_flag
  bits.se(0); // slice_qp_delta
  bits.ue(1); // disable_deblocking_filter_idc: off
  for (let mbY = 0; mbY < heightMbs; mbY += 1) {
    for (let mbX = 0; mbX < widthMbs; mbX += 1) {
      bits.ue(25); // mb_type: I_PCM
      while (!bits.aligned) bits.bit(0); // pcm_alignment_zero_bit
      for (let y = 0; y < 16; y += 1) {
        for (let x = 0; x < 16; x += 1) bits.u(luma(mbX * 16 + x, mbY * 16 + y), 8);
      }
      for (const plane of [cb, cr]) {
        for (let y = 0; y < 8; y += 1) {
          for (let x = 0; x < 8; x += 1) bits.u(plane(mbX * 8 + x, mbY * 8 + y), 8);
        }
      }
    }
  }
  bits.trailing();
  return nal(5, bits.bytes);
}

// MP4 boxes.

type Part = Uint8Array | number[];

function concat(...parts: Part[]): Uint8Array {
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
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const zeros = (count: number) => new Array<number>(count).fill(0);
const fullBox = (version = 0, flags = 0) => [version, ...u32(flags).slice(1)];
const matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);

function box(type: string, ...payload: Part[]): Uint8Array {
  const body = concat(...payload);
  return concat(u32(body.length + 8), ascii(type), body);
}

/**
 * A `width` × `height` H.264 MP4 (multiples of 16), `frames` long at 10 fps:
 * warm stone colours drifting across the picture, so frames differ.
 */
export function playableH264Mp4({ width = 256, height = 144, frames = 10 } = {}): Uint8Array {
  const widthMbs = width / 16;
  const heightMbs = height / 16;
  const spsNal = sps(widthMbs, heightMbs);
  const ppsNal = pps();
  const samples = Array.from({ length: frames }, (_, index) => {
    const shift = index * 6;
    const slice = frame(
      index,
      widthMbs,
      heightMbs,
      (x, y) => 40 + (Math.round(((x + shift) / width) * 120 + (y / height) * 60) % 180),
      () => 110,
      (x) => 140 + Math.round((((x + shift) % width) / width) * 20),
    );
    return concat(u32(slice.length), slice);
  });

  const timescale = 1000;
  const delta = 100;
  const duration = frames * delta;
  const ftyp = box(
    "ftyp",
    ascii("isom"),
    u32(512),
    ascii("isom"),
    ascii("iso2"),
    ascii("avc1"),
    ascii("mp41"),
  );

  const moov = (chunkOffset: number) =>
    box(
      "moov",
      box(
        "mvhd",
        fullBox(),
        u32(0),
        u32(0),
        u32(timescale),
        u32(duration),
        u32(0x00010000),
        u16(0x0100),
        zeros(10),
        matrix,
        zeros(24),
        u32(2),
      ),
      box(
        "trak",
        box(
          "tkhd",
          fullBox(0, 3),
          u32(0),
          u32(0),
          u32(1),
          u32(0),
          u32(duration),
          zeros(8),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          matrix,
          u32(width << 16),
          u32(height << 16),
        ),
        box(
          "mdia",
          box(
            "mdhd",
            fullBox(),
            u32(0),
            u32(0),
            u32(timescale),
            u32(duration),
            u16(0x55c4),
            u16(0),
          ),
          box("hdlr", fullBox(), u32(0), ascii("vide"), zeros(12), ascii("VideoHandler"), [0]),
          box(
            "minf",
            box("vmhd", fullBox(0, 1), zeros(8)),
            box("dinf", box("dref", fullBox(), u32(1), box("url ", fullBox(0, 1)))),
            box(
              "stbl",
              box(
                "stsd",
                fullBox(),
                u32(1),
                box(
                  "avc1",
                  zeros(6),
                  u16(1),
                  zeros(16),
                  u16(width),
                  u16(height),
                  u32(0x00480000),
                  u32(0x00480000),
                  u32(0),
                  u16(1),
                  zeros(32),
                  u16(0x0018),
                  u16(0xffff),
                  box(
                    "avcC",
                    [1, profile, compatibility, level, 0xff, 0xe1],
                    u16(spsNal.length),
                    spsNal,
                    [1],
                    u16(ppsNal.length),
                    ppsNal,
                  ),
                ),
              ),
              box("stts", fullBox(), u32(1), u32(frames), u32(delta)),
              box("stsc", fullBox(), u32(1), u32(1), u32(frames), u32(1)),
              box(
                "stsz",
                fullBox(),
                u32(0),
                u32(frames),
                samples.flatMap((sample) => u32(sample.length)),
              ),
              box("stco", fullBox(), u32(1), u32(chunkOffset)),
            ),
          ),
        ),
      ),
    );

  const moovLength = moov(0).length;
  const mdat = box("mdat", ...samples);
  // The first sample starts after ftyp, moov and mdat's own header.
  return concat(ftyp, moov(ftyp.length + moovLength + 8), mdat);
}
