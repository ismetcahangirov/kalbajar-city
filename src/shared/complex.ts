import { z } from "zod";

import type { Localized } from "@/i18n/content";

import type { PublicApartmentStatus } from "./apartments";

/**
 * The complex selector on `/kompleks` (#19): block, then floor, then the
 * apartments on that floor. Hotspots are polygons in normalised coordinates
 * (0–1 on both axes of the picture), so when the owner's facade render and
 * floor plans arrive, polygons drawn on them in the console replace the
 * schematic ones computed here without changing how they are drawn.
 */

/**
 * A picture hotspots are drawn on: the site render, a block's facade, a
 * floor's plan. Only what an SVG `<image>` needs.
 */
export type SelectorPicture = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Shown with the "Illustrative" chip, as everywhere else. */
  illustrative: boolean;
};

export type SelectorApartment = {
  slug: string;
  number: string;
  status: PublicApartmentStatus;
  rooms: number;
  areaTotal: string;
  /** Drawn on the floor's plan in the console; null until then. */
  planPolygon: Polygon | null;
};

export type SelectorFloor = {
  number: number;
  apartments: SelectorApartment[];
  /** Drawn on the block's facade. */
  facadePolygon: Polygon | null;
  /** The floor plan the apartments' hotspots are drawn on. */
  plan: SelectorPicture | null;
};

export type SelectorBlock = {
  code: string;
  name: Localized;
  building: { slug: string; name: Localized };
  floors: SelectorFloor[];
  /** Drawn on the site render. */
  sitePolygon: Polygon | null;
  /** The facade render the floors' hotspots are drawn on. */
  facade: SelectorPicture | null;
};

/** Public apartments only, grouped by block and floor in natural order. */
export type ComplexSelectorData = {
  /** The site render the blocks' hotspots are drawn on. */
  site: SelectorPicture | null;
  blocks: SelectorBlock[];
};

export type StatusCounts = Record<PublicApartmentStatus, number> & { total: number };

export function statusCounts(apartments: readonly SelectorApartment[]): StatusCounts {
  const counts: StatusCounts = { available: 0, reserved: 0, sold: 0, total: 0 };
  for (const apartment of apartments) {
    counts[apartment.status] += 1;
    counts.total += 1;
  }
  return counts;
}

export const blockApartments = (block: SelectorBlock) =>
  block.floors.flatMap((floor) => floor.apartments);

/** `?blok=A&mertebe=3`. Anything unreadable is dropped, not an error. */
const blockParam = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,8}$/)
  .transform((code) => code.toUpperCase());
const floorParam = z.coerce.number().int().min(-5).max(200);

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export type Selection = {
  block: SelectorBlock | null;
  floor: SelectorFloor | null;
};

/**
 * The selection a URL asks for, resolved against the inventory: an unknown
 * block shows every block; a floor the block does not have shows its floors.
 */
export function resolveSelection(data: ComplexSelectorData, params: SearchParams): Selection {
  const code = blockParam.safeParse(first(params.blok)).data;
  const block = code ? (data.blocks.find((item) => item.code === code) ?? null) : null;
  if (!block) return { block: null, floor: null };
  const number = floorParam.safeParse(first(params.mertebe)).data;
  const floor =
    number === undefined ? null : (block.floors.find((item) => item.number === number) ?? null);
  return { block, floor };
}

/** The query string of a selection, for links. */
export function selectionQuery(block?: string, floor?: number): Record<string, string> {
  if (!block) return {};
  return floor === undefined ? { blok: block } : { blok: block, mertebe: String(floor) };
}

/** Whether a request named any selection at all, valid or not. */
export function hasSelectionParams(params: SearchParams): boolean {
  return Object.keys(params).length > 0;
}

// ---------------------------------------------------------------------------
// Geometry

export type Point = readonly [x: number, y: number];
export type Polygon = readonly Point[];

/** A drawing's size in SVG user units; normalised hotspots scale into it. */
export type Canvas = { readonly width: number; readonly height: number };

/** The schematic picture's size in SVG user units; hotspots scale into it. */
export const canvas = { width: 1000, height: 625 } as const satisfies Canvas;

const round = (value: number) => Math.round(value * 10_000) / 10_000;

const unit = z.number().min(0).max(1);

/** Twice the signed area of a polygon (shoelace), in normalised units. */
function doubleArea(polygon: Polygon): number {
  let sum = 0;
  polygon.forEach(([x1, y1], index) => {
    const [x2, y2] = polygon[(index + 1) % polygon.length] ?? [x1, y1];
    sum += x1 * y2 - x2 * y1;
  });
  return sum;
}

/**
 * A hotspot as the console stores it: 3 to 64 points, each 0–1 on both axes
 * of its picture, rounded to four places (a tenth of a pixel on a 1000 px
 * render), and enclosing some area, so a misclick cannot save a line.
 */
export const selectorPolygonSchema = z
  .array(z.tuple([unit, unit]))
  .min(3, "Draw at least three points")
  .max(64, "Use at most 64 points")
  .transform((points): Polygon => points.map(([x, y]) => [round(x), round(y)] as const))
  .refine((polygon) => Math.abs(doubleArea(polygon)) / 2 >= 0.0001, "The shape has no area");

/** The canvas of a picture: 1000 user units wide, as tall as its aspect ratio. */
export function pictureCanvas(picture: Pick<SelectorPicture, "width" | "height">): Canvas {
  return {
    width: canvas.width,
    height: Math.round((canvas.width * picture.height) / picture.width),
  };
}

/**
 * A level is drawn on its picture once the picture is set and every hotspot
 * on it is drawn; until then the schematic layout stands in, so a half-drawn
 * render never hides an apartment from the plan.
 */
export function drawnView(
  picture: SelectorPicture | null,
  polygons: ReadonlyArray<Polygon | null>,
): { picture: SelectorPicture; canvas: Canvas; polygons: Polygon[] } | null {
  if (!picture || !polygons.length) return null;
  const drawn = polygons.filter((polygon): polygon is Polygon => polygon !== null);
  if (drawn.length !== polygons.length) return null;
  return { picture, canvas: pictureCanvas(picture), polygons: drawn };
}

/** Text as a sentence for a caption: a full stop unless it already ends in one. */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

type Box = { x: number; y: number; w: number; h: number };

function rect({ x, y, w, h }: Box): Polygon {
  return [
    [round(x), round(y)],
    [round(x + w), round(y)],
    [round(x + w), round(y + h)],
    [round(x), round(y + h)],
  ];
}

/** `points` for an SVG `<polygon>` in the canvas's user units. */
export function toSvgPoints(polygon: Polygon, size: Canvas = canvas): string {
  return polygon.map(([x, y]) => `${round(x * size.width)},${round(y * size.height)}`).join(" ");
}

/**
 * Where a polygon's label goes, in user units: its centroid, which stays
 * inside the L and T shapes drawn on renders, or the centre of its bounding
 * box when the shape has no area to weigh.
 */
export function labelPoint(polygon: Polygon, size: Canvas = canvas): { x: number; y: number } {
  const a = doubleArea(polygon);
  let cx: number;
  let cy: number;
  if (Math.abs(a) < 1e-9) {
    const xs = polygon.map(([x]) => x);
    const ys = polygon.map(([, y]) => y);
    cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  } else {
    let sx = 0;
    let sy = 0;
    polygon.forEach(([x1, y1], index) => {
      const [x2, y2] = polygon[(index + 1) % polygon.length] ?? [x1, y1];
      const cross = x1 * y2 - x2 * y1;
      sx += (x1 + x2) * cross;
      sy += (y1 + y2) * cross;
    });
    cx = sx / (3 * a);
    cy = sy / (3 * a);
  }
  return { x: round(cx * size.width), y: round(cy * size.height) };
}

/** A polygon's bounding-box size in user units, for fitting its text. */
export function boxSize(
  polygon: Polygon,
  size: Canvas = canvas,
): { width: number; height: number } {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return {
    width: (Math.max(...xs) - Math.min(...xs)) * size.width,
    height: (Math.max(...ys) - Math.min(...ys)) * size.height,
  };
}

/**
 * The site plan: buildings in a grid of up to three columns, each split into
 * its blocks side by side. Returns a polygon per block code.
 */
export function siteLayout(blocks: readonly SelectorBlock[]): Map<string, Polygon> {
  const buildings: SelectorBlock[][] = [];
  for (const block of blocks) {
    const group = buildings.find((items) => items[0]?.building.slug === block.building.slug);
    if (group) group.push(block);
    else buildings.push([block]);
  }

  const columns = Math.min(3, Math.max(1, buildings.length));
  const rows = Math.max(1, Math.ceil(buildings.length / columns));
  const margin = 0.04;
  const gapX = 0.04;
  const gapY = 0.08;
  const cellW = (1 - 2 * margin - gapX * (columns - 1)) / columns;
  const cellH = (1 - 2 * margin - gapY * (rows - 1)) / rows;
  const blockGap = 0.012;

  const out = new Map<string, Polygon>();
  buildings.forEach((group, index) => {
    const x = margin + (index % columns) * (cellW + gapX);
    const y = margin + Math.floor(index / columns) * (cellH + gapY);
    const w = (cellW - blockGap * (group.length - 1)) / group.length;
    group.forEach((block, i) => {
      out.set(block.code, rect({ x: x + i * (w + blockGap), y, w, h: cellH }));
    });
  });
  return out;
}

/** A block's elevation: one band per floor, the highest at the top. */
export function facadeLayout(floors: readonly number[]): Map<number, Polygon> {
  const sorted = [...floors].sort((a, b) => b - a);
  const top = 0.06;
  const bottom = 0.96;
  const x = 0.12;
  const w = 0.76;
  const gap = 0.012;
  const h = (bottom - top - gap * (sorted.length - 1)) / Math.max(1, sorted.length);
  return new Map(sorted.map((number, i) => [number, rect({ x, y: top + i * (h + gap), w, h })]));
}

/**
 * A floor: apartments in two rows either side of a corridor, in door order,
 * the first row left to right and the second right to left, as a corridor
 * is walked.
 */
export function floorLayout(count: number): Polygon[] {
  if (count <= 0) return [];
  const margin = 0.04;
  const corridor = 0.12;
  const gap = 0.012;
  const topCount = Math.ceil(count / 2);
  const bottomCount = count - topCount;
  const rowCount = bottomCount > 0 ? 2 : 1;
  const rowH = (1 - 2 * margin - (rowCount === 2 ? corridor : 0)) / rowCount;
  const row = (n: number, y: number, reverse: boolean): Polygon[] => {
    const w = (1 - 2 * margin - gap * (n - 1)) / n;
    const cells = Array.from({ length: n }, (_, i) =>
      rect({ x: margin + i * (w + gap), y, w, h: rowH }),
    );
    return reverse ? cells.reverse() : cells;
  };
  return [
    ...row(topCount, margin, false),
    ...(bottomCount > 0 ? row(bottomCount, margin + rowH + corridor, true) : []),
  ];
}
