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
import {
  apartmentStatuses,
  areaInputSchema,
  aznInputSchema,
  type ApartmentStatus,
  type RoomArea,
} from "./inventory";

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

/** `GET /api/v1/admin/apartments`; the CSV export takes the same filters. */
export const adminApartmentListQuerySchema = paginationSchema.extend({
  status: listOf(z.enum(apartmentStatuses)),
  block: listOf(blockCode),
  rooms: roomsFilter,
  floor: listOf(floor),
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
  floor?: number[];
  q?: string;
  sort?: SortKey<"number" | "area" | "floor" | "price" | "updatedAt">;
};

export const apartmentIdParamsSchema = z.object({ id: z.uuid() });

/** The number on the door: `101`, `12A`, `3-04`. */
export const apartmentNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z][0-9A-Za-z-]{0,11}$/, "Use up to 12 letters, digits or hyphens");

/** `POST /api/v1/admin/apartments`. The slug is made from the block and the number. */
export const apartmentCreateSchema = z.strictObject({
  number: apartmentNumberSchema,
  floorId: z.uuid(),
  layoutTypeId: z.uuid(),
  areaTotal: areaInputSchema,
  status: z.enum(apartmentStatuses).default("available"),
  /** Minor units; `null` until the owner sets it. */
  priceMinor: minorAmountSchema.nullable().default(null),
});

export type ApartmentCreate = z.input<typeof apartmentCreateSchema>;

/**
 * `PATCH /api/v1/admin/apartments/:id`. Changing the status needs
 * `apartmentStatus:update`, which sales has; every other field needs
 * `inventory:update`.
 */
export const apartmentUpdateSchema = z
  .strictObject({
    number: apartmentNumberSchema,
    floorId: z.uuid(),
    layoutTypeId: z.uuid(),
    areaTotal: areaInputSchema,
    status: z.enum(apartmentStatuses),
    /** Minor units; `null` clears the price. */
    priceMinor: minorAmountSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");

export type ApartmentUpdate = z.input<typeof apartmentUpdateSchema>;

/** The fields sales may change; anything else needs `inventory:update`. */
export const salesApartmentFields: ReadonlySet<string> = new Set(["status"]);

/**
 * The console's apartment form: the API's fields, with the price typed in
 * AZN (`125 000,50`) instead of qəpik. `toApartmentBody` turns its output
 * into the request body.
 */
export const apartmentFormSchema = apartmentCreateSchema
  .omit({ priceMinor: true, status: true })
  .extend({ status: z.enum(apartmentStatuses), price: aznInputSchema });

export type ApartmentFormValues = z.input<typeof apartmentFormSchema>;

export function toApartmentBody({
  price,
  ...rest
}: z.output<typeof apartmentFormSchema>): z.input<typeof apartmentCreateSchema> {
  return { ...rest, priceMinor: price };
}

/**
 * A bulk change. "Publish" and "unpublish" are status changes: unpublishing
 * sets `not_for_sale`, which the public site never shows; publishing puts
 * `not_for_sale` apartments back on sale (`available`) and leaves reserved
 * and sold ones as they are.
 */
export const bulkChangeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("status"), status: z.enum(apartmentStatuses) }),
  z.strictObject({ kind: z.literal("publish") }),
  z.strictObject({ kind: z.literal("unpublish") }),
  /** One price for all; `null` clears it. */
  z.strictObject({ kind: z.literal("priceSet"), priceMinor: minorAmountSchema.nullable() }),
  /** A change by a percentage, e.g. `5` or `-2.5`; apartments without a price keep none. */
  z.strictObject({
    kind: z.literal("pricePercent"),
    percent: z
      .number()
      .min(-90)
      .max(500)
      .refine((value) => value !== 0, "A change of 0% changes nothing")
      .refine((value) => Number.isInteger(value * 100), "At most two decimals"),
  }),
]);

export type BulkChange = z.input<typeof bulkChangeSchema>;

export const maxBulkIds = 500;

/** `PATCH /api/v1/admin/apartments`: one change to many apartments, in one transaction. */
export const apartmentBulkSchema = z.strictObject({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(maxBulkIds)
    .refine((ids) => new Set(ids).size === ids.length, "An apartment may appear only once"),
  change: bulkChangeSchema,
});

export type ApartmentBulk = z.input<typeof apartmentBulkSchema>;

export type ApartmentBulkResult = { updated: number; unchanged: number };

/** Whether a bulk change touches prices, which sales may not do. */
export function changesPrice(change: BulkChange): boolean {
  return change.kind === "priceSet" || change.kind === "pricePercent";
}

/**
 * What an apartment becomes under a bulk change. The console's preview and
 * the endpoint both use it, so the preview shows exactly what will be stored.
 * Percentages round to the nearest qəpik.
 */
export function applyBulkChange(
  apartment: { status: ApartmentStatus; priceMinor: string | null },
  change: BulkChange,
): { status: ApartmentStatus; priceMinor: string | null } {
  switch (change.kind) {
    case "status":
      return { ...apartment, status: change.status };
    case "publish":
      return {
        ...apartment,
        status: apartment.status === "not_for_sale" ? "available" : apartment.status,
      };
    case "unpublish":
      return { ...apartment, status: "not_for_sale" };
    case "priceSet":
      return { ...apartment, priceMinor: change.priceMinor };
    case "pricePercent": {
      if (apartment.priceMinor === null) return apartment;
      // Basis points in integers, so 0.1 + 0.2 never shows up in a price.
      const basis = BigInt(Math.round(change.percent * 100)) + 10_000n;
      const scaled = BigInt(apartment.priceMinor) * basis;
      const rounded = (scaled + 5_000n) / 10_000n;
      return { ...apartment, priceMinor: String(rounded < 0n ? 0n : rounded) };
    }
  }
}

export type AdminApartment = {
  id: string;
  slug: string;
  number: string;
  status: ApartmentStatus;
  areaTotal: string;
  priceMinor: string | null;
  currency: string;
  isDemo: boolean;
  floorId: string;
  floor: number;
  block: string;
  layoutTypeId: string;
  layout: { code: string; rooms: number };
  updatedAt: string;
};
