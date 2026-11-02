import { z } from "zod";

import type { Localized } from "@/i18n/content";
import type { Locale } from "@/i18n/routing";
import type { PublicImage } from "@/lib/public/media";

import {
  listOf,
  localeQuerySchema,
  minorAmountSchema,
  paginationSchema,
  sortSchema,
  type Money,
} from "./api";
import { apartmentStatuses, type ApartmentStatus, type RoomArea } from "./inventory";

/**
 * The public site never lists `not_for_sale`: those apartments are kept back
 * by the developer and are not on offer.
 */
export const publicApartmentStatuses = ["available", "reserved", "sold"] as const;

export type PublicApartmentStatus = (typeof publicApartmentStatuses)[number];

const roomsFilter = listOf(z.coerce.number().int().min(1).max(10));
const blockCode = z.string().regex(/^[A-Za-z0-9-]{1,8}$/, "Unknown block code");
const area = z.coerce.number().positive().max(100_000);
const floor = z.coerce.number().int().min(-5).max(200);
/** Minor units (qəpik), like every price on the wire. */
const price = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

function ordered(min: string, max: string) {
  return (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const low = value[min];
    const high = value[max];
    if (typeof low === "number" && typeof high === "number" && low > high) {
      ctx.addIssue({ code: "custom", path: [max], message: `${max} must not be below ${min}` });
    }
  };
}

/** `GET /api/v1/apartments`. */
export const apartmentListQuerySchema = paginationSchema
  .extend({
    locale: localeQuerySchema,
    rooms: roomsFilter,
    block: listOf(blockCode),
    status: listOf(z.enum(publicApartmentStatuses)),
    areaMin: area.optional(),
    areaMax: area.optional(),
    floorMin: floor.optional(),
    floorMax: floor.optional(),
    /** Price filter and price sort apply only while prices are public. */
    priceMin: price.optional(),
    priceMax: price.optional(),
    sort: sortSchema(["number", "area", "floor", "price"], "number"),
  })
  .superRefine(ordered("areaMin", "areaMax"))
  .superRefine(ordered("floorMin", "floorMax"))
  .superRefine(ordered("priceMin", "priceMax"));

export type ApartmentListQuery = z.output<typeof apartmentListQuerySchema>;

/**
 * While prices are hidden (#7), a price filter or a price sort is ignored:
 * filtering would reveal which apartments cost less than a figure, and
 * sorting would reveal their order. The catalogue then sorts naturally.
 */
export function withPriceVisibility(
  query: ApartmentListQuery,
  pricesVisible: boolean,
): ApartmentListQuery {
  if (pricesVisible) return query;
  const rest = { ...query };
  delete rest.priceMin;
  delete rest.priceMax;
  if (rest.sort.field === "price") rest.sort = { field: "number", direction: "asc" };
  return rest;
}

type SortKey<F extends string> = F | `-${F}`;

/** What a client passes; arrays go out comma-separated. */
export type ApartmentListParams = {
  page?: number;
  pageSize?: number;
  locale?: Locale;
  rooms?: number[];
  block?: string[];
  status?: PublicApartmentStatus[];
  areaMin?: number;
  areaMax?: number;
  floorMin?: number;
  floorMax?: number;
  /** Minor units; ignored while prices are hidden. */
  priceMin?: number;
  priceMax?: number;
  sort?: SortKey<"number" | "area" | "floor" | "price">;
};

export const apartmentSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
});

/** `?locale=` on public detail and layout endpoints. */
export const localeOnlyQuerySchema = z.object({ locale: localeQuerySchema });

export type PublicApartment = {
  slug: string;
  number: string;
  status: PublicApartmentStatus;
  rooms: number;
  areaTotal: string;
  floor: number;
  block: { code: string; name: Localized };
  layout: { slug: string; code: string };
  /** Null while prices are hidden (#7) or not set. */
  price: Money | null;
  plan: PublicImage | null;
};

export type PublicApartmentDetail = PublicApartment & {
  building: { slug: string; name: Localized };
  roomAreas: RoomArea[];
  description: Localized | null;
  /** Images of the layout beyond its plan (interiors, views); often empty. */
  gallery: PublicImage[];
};

export type PublicLayoutType = {
  slug: string;
  code: string;
  rooms: number;
  areaTotal: string;
  roomAreas: RoomArea[];
  description: Localized | null;
  plan: PublicImage | null;
  /** Apartments of this layout that are available now. */
  available: number;
};

/** `GET /api/v1/admin/apartments`. */
export const adminApartmentListQuerySchema = paginationSchema.extend({
  status: listOf(z.enum(apartmentStatuses)),
  block: listOf(blockCode),
  rooms: roomsFilter,
  /** Part of an apartment's number. */
  q: z.string().trim().max(20).optional(),
  sort: sortSchema(["number", "area", "floor", "price", "updatedAt"], "number"),
});

export type AdminApartmentListParams = {
  page?: number;
  pageSize?: number;
  status?: ApartmentStatus[];
  block?: string[];
  rooms?: number[];
  q?: string;
  sort?: SortKey<"number" | "area" | "floor" | "price" | "updatedAt">;
};

export const apartmentIdParamsSchema = z.object({ id: z.uuid() });

/**
 * `PATCH /api/v1/admin/apartments/:id`. Changing the status needs
 * `apartmentStatus:update`, which sales has; changing the price needs
 * `inventory:update`.
 */
export const apartmentUpdateSchema = z
  .strictObject({
    status: z.enum(apartmentStatuses).optional(),
    /** Minor units; `null` clears the price. */
    priceMinor: minorAmountSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");

export type ApartmentUpdate = z.input<typeof apartmentUpdateSchema>;

export type AdminApartment = {
  id: string;
  slug: string;
  number: string;
  status: ApartmentStatus;
  areaTotal: string;
  priceMinor: string | null;
  currency: string;
  isDemo: boolean;
  floor: number;
  block: string;
  layout: { code: string; rooms: number };
  updatedAt: string;
};
