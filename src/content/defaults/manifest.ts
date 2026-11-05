/**
 * The default image of every image slot on the public site (spec §8): what
 * a visitor sees until the console chooses a file. This file says where each
 * default comes from and how it is cropped; `pnpm defaults:encode` reads it,
 * crops the originals and writes `public/defaults/<slot>/<width>.<avif|webp>`
 * and `encoded.json` (sizes, placeholder, dominant colour). `docs/defaults.md`
 * lists the same entries for people.
 *
 * Instagram defaults are photos and renders from the complex's own account
 * (@kalbajar.city) and may show the complex. Generated defaults are
 * atmosphere only, never the complex, an apartment, a view from it or an
 * amenity (`CLAUDE.md` → Imagery), and always carry the "Illustrative" chip.
 */

export const defaultSlots = [
  "home.hero.poster",
  "home.hero.panel",
  "home.about.image",
  "home.about.background",
  "home.stats.background",
  "home.layouts.background",
  "home.cardZoom.1",
  "home.cardZoom.2",
  "home.cardZoom.3",
  "home.cardZoom.4",
  "home.amenities.window",
  "home.location.intro",
  "home.location.moverLeft",
  "home.location.moverRight",
  "home.location.card.1",
  "home.location.card.2",
  "home.location.card.3",
  "home.location.card.4",
  "home.location.card.5",
  "home.location.card.6",
  "home.construction.background",
  "home.cta.portrait",
  "page.menziller",
  "page.haqqimizda",
  "page.kompleks",
  "page.yerlesme",
  "page.qalereya",
  "page.tikinti",
  "page.xeberler",
  "page.elaqe",
  "decor.leafShadow.1",
  "decor.leafShadow.2",
  "decor.plaster",
] as const;

export type DefaultSlot = (typeof defaultSlots)[number];

export type DefaultSource = "instagram" | "generated";

export type DefaultEntry = {
  /** The original, relative to the originals folder (never committed; see `pnpm defaults:encode`). */
  original: string;
  /** Width ÷ height of the crop: the slot's frame, so nothing is cropped twice. */
  aspect: number;
  /**
   * The point the crop is centred on, as fractions of the original; it also
   * becomes the image's `object-position` inside the crop.
   */
  focus: { x: number; y: number };
  /**
   * The part of the original the crop stays inside, `[left, top, right,
   * bottom]` as fractions: how a caption or the account's wordmark is left out.
   */
  within?: readonly [number, number, number, number];
  /** The widest file to make; narrower slots (blurred backgrounds) need less. */
  maxWidth?: number;
  /** A file below the standard widths, for a slot that only ever shows small. */
  smallWidth?: number;
  /** No alt text: purely decorative, hidden from assistive technology. */
  decorative?: boolean;
  source: DefaultSource;
  /** The Instagram post's URL, or the prompt's id in `docs/defaults.md` (G1…). */
  ref: string;
  /** When the original was collected or generated. */
  date: string;
};

const instagram = (post: string) => `https://www.instagram.com/p/${post}/`;
const reel = (post: string) => `https://www.instagram.com/reel/${post}/`;

/** The account's wordmark sits in the bottom tenth of these renders. */
const aboveWordmark = [0, 0, 1, 0.9] as const;

const collected = "2026-11-04";

export const defaultEntries: Record<DefaultSlot, DefaultEntry> = {
  "home.hero.poster": {
    original: "instagram/DcIYfGcjyma-cover.jpg",
    aspect: 3 / 4,
    focus: { x: 0.5, y: 0.55 },
    // The hero's tile: a third of a phone's width, a sixth of a desktop's.
    smallWidth: 320,
    source: "instagram",
    ref: reel("DcIYfGcjyma"),
    date: collected,
  },
  "home.hero.panel": {
    original: "instagram/DdliV-rkwSb-cover.jpg",
    aspect: 9 / 16,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: reel("DdliV-rkwSb"),
    date: collected,
  },
  "home.about.image": {
    original: "instagram/De198LdCuqf-3.jpg",
    aspect: 4 / 3,
    focus: { x: 0.5, y: 0.35 },
    // The wordmark is centred low on the right; the facade above it is clear.
    within: [0, 0, 1, 0.68],
    source: "instagram",
    ref: instagram("De198LdCuqf"),
    date: collected,
  },
  "home.about.background": {
    original: "instagram/DclNox7iWYF-cover.jpg",
    aspect: 9 / 16,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: reel("DclNox7iWYF"),
    date: collected,
  },
  "home.stats.background": {
    original: "generated/g4-linen-timber.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.5 },
    source: "generated",
    ref: "G4",
    date: collected,
  },
  "home.layouts.background": {
    original: "generated/g5-light-on-wall.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.5 },
    source: "generated",
    ref: "G5",
    date: collected,
  },
  "home.cardZoom.1": {
    original: "instagram/DctO4F5DY2k-11.jpg",
    aspect: 4 / 5,
    focus: { x: 0.45, y: 0.5 },
    within: aboveWordmark,
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.cardZoom.2": {
    original: "instagram/DdntuKTCoka-2.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DdntuKTCoka"),
    date: collected,
  },
  "home.cardZoom.3": {
    original: "instagram/DeJ1qC3FZwu-cover.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: reel("DeJ1qC3FZwu"),
    date: collected,
  },
  "home.cardZoom.4": {
    original: "instagram/DdG02VBCAQx-cover.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: reel("DdG02VBCAQx"),
    date: collected,
  },
  "home.amenities.window": {
    original: "generated/g6-mountain-valley.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.5 },
    source: "generated",
    ref: "G6",
    date: collected,
  },
  "home.location.intro": {
    original: "instagram/DXPHoGyjZW6-cover.jpg",
    aspect: 16 / 9,
    focus: { x: 0.5, y: 0.62 },
    source: "instagram",
    ref: reel("DXPHoGyjZW6"),
    date: collected,
  },
  "home.location.moverLeft": {
    original: "generated/g7-mountain-stone.jpg",
    aspect: 5 / 6,
    focus: { x: 0.5, y: 0.5 },
    source: "generated",
    ref: "G7",
    date: collected,
  },
  "home.location.moverRight": {
    original: "generated/g8-terrazzo-timber.jpg",
    aspect: 5 / 6,
    focus: { x: 0.5, y: 0.5 },
    source: "generated",
    ref: "G8",
    date: collected,
  },
  "home.location.card.1": {
    original: "instagram/DctO4F5DY2k-1.jpg",
    aspect: 11 / 6,
    focus: { x: 0.5, y: 0.6 },
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.location.card.2": {
    original: "instagram/DctO4F5DY2k-2.jpg",
    aspect: 11 / 6,
    focus: { x: 0.5, y: 0.45 },
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.location.card.3": {
    original: "instagram/DctO4F5DY2k-3.jpg",
    aspect: 11 / 6,
    focus: { x: 0.5, y: 0.4 },
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.location.card.4": {
    original: "instagram/DctO4F5DY2k-5.jpg",
    aspect: 11 / 6,
    focus: { x: 0.5, y: 0.6 },
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.location.card.5": {
    original: "instagram/DctO4F5DY2k-9.jpg",
    aspect: 11 / 6,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.location.card.6": {
    original: "instagram/DctO4F5DY2k-10.jpg",
    aspect: 11 / 6,
    focus: { x: 0.5, y: 0.45 },
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "home.construction.background": {
    original: "instagram/DeMTljLDXZ8-1.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.45 },
    source: "instagram",
    ref: instagram("DeMTljLDXZ8"),
    date: collected,
  },
  "home.cta.portrait": {
    original: "instagram/DcvypZAjSmg-0.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DcvypZAjSmg"),
    date: collected,
  },
  "page.menziller": {
    original: "instagram/DdCAmP8jYsl-2.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DdCAmP8jYsl"),
    date: collected,
  },
  "page.haqqimizda": {
    original: "instagram/DcSoHUvj301-cover.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.55 },
    source: "instagram",
    ref: reel("DcSoHUvj301"),
    date: collected,
  },
  "page.kompleks": {
    original: "instagram/DctO4F5DY2k-4.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    within: aboveWordmark,
    source: "instagram",
    ref: instagram("DctO4F5DY2k"),
    date: collected,
  },
  "page.yerlesme": {
    original: "instagram/DXPHoGyjZW6-cover.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.55 },
    // A portrait frame never needs the 2304 px original's full width.
    maxWidth: 1600,
    source: "instagram",
    ref: reel("DXPHoGyjZW6"),
    date: collected,
  },
  "page.qalereya": {
    original: "instagram/DdJCNfnjU8y-2.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DdJCNfnjU8y"),
    date: collected,
  },
  "page.tikinti": {
    original: "instagram/DeMTljLDXZ8-6.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DeMTljLDXZ8"),
    date: collected,
  },
  "page.xeberler": {
    original: "instagram/DeMTljLDXZ8-3.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("DeMTljLDXZ8"),
    date: collected,
  },
  "page.elaqe": {
    original: "instagram/Dc08-GPDYNt-0.jpg",
    aspect: 4 / 5,
    focus: { x: 0.5, y: 0.5 },
    source: "instagram",
    ref: instagram("Dc08-GPDYNt"),
    date: collected,
  },
  "decor.leafShadow.1": {
    original: "generated/g1-leaf-shadow.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.5 },
    maxWidth: 960,
    decorative: true,
    source: "generated",
    ref: "G1",
    date: collected,
  },
  "decor.leafShadow.2": {
    original: "generated/g2-leaf-shadow.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.5 },
    maxWidth: 960,
    decorative: true,
    source: "generated",
    ref: "G2",
    date: collected,
  },
  "decor.plaster": {
    original: "generated/g3-plaster.jpg",
    aspect: 3 / 2,
    focus: { x: 0.5, y: 0.5 },
    maxWidth: 960,
    decorative: true,
    source: "generated",
    ref: "G3",
    date: collected,
  },
};
