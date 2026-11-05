import { z } from "zod";

import { selectorPolygonSchema, type Polygon } from "./complex";
import type { ApartmentStatus } from "./inventory";

/*
 * The console's polygon editor for the complex selector (#19). Three levels,
 * each a picture with a hotspot per item of the level below:
 *
 * - `site`: the site render, a hotspot per block
 * - `block`: a block's facade render, a hotspot per floor
 * - `floor`: a floor's plan, a hotspot per apartment
 */

export const selectorLevels = ["site", "block", "floor"] as const;

export type SelectorLevel = (typeof selectorLevels)[number];

/** `GET /api/v1/admin/selector`: no ids for the site, a block, or a block's floor. */
export const selectorViewQuerySchema = z.object({
  block: z.uuid().optional(),
  floor: z.uuid().optional(),
});

export type SelectorViewQuery = z.infer<typeof selectorViewQuerySchema>;

/**
 * `PUT /api/v1/admin/selector/picture`: set or clear a level's picture. A
 * floor's picture is its plan, the same one the structure page sets.
 */
export const selectorPictureSchema = z.strictObject({
  level: z.enum(selectorLevels),
  /** The block (level `block`) or floor (level `floor`); none for the site. */
  id: z.uuid().nullable().default(null),
  mediaId: z.uuid().nullable(),
});

export type SelectorPictureInput = z.input<typeof selectorPictureSchema>;

/** `PUT /api/v1/admin/selector/hotspot`: draw or clear one item's hotspot on a level's picture. */
export const selectorHotspotSchema = z.strictObject({
  level: z.enum(selectorLevels),
  /** The block (on the site), floor (on a facade) or apartment (on a plan). */
  id: z.uuid(),
  polygon: selectorPolygonSchema.nullable(),
});

export type SelectorHotspotInput = z.input<typeof selectorHotspotSchema>;

/** A picture as the editor draws on it: a large preview and its size. */
export type AdminSelectorPicture = {
  id: string;
  url: string | null;
  /** A small preview, for the media picker. */
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  /** The public site leaves out an image without alt text. */
  missingAlt: boolean;
};

export type AdminSelectorHotspot = {
  id: string;
  /** What staff call it: `A`, `3`, `301`. */
  label: string;
  polygon: Polygon | null;
  /** Apartments only. `not_for_sale` ones may be drawn but are not shown publicly. */
  status: ApartmentStatus | null;
};

export type AdminSelectorView = {
  level: SelectorLevel;
  /** The block or floor whose picture this is; null for the site. */
  id: string | null;
  picture: AdminSelectorPicture | null;
  hotspots: AdminSelectorHotspot[];
};
