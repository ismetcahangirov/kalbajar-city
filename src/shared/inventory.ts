import { z } from "zod";

export const apartmentStatuses = ["available", "reserved", "sold", "not_for_sale"] as const;

export type ApartmentStatus = (typeof apartmentStatuses)[number];

/** Room kinds of a layout's area breakdown; their names live in the message catalogues. */
export const roomKinds = [
  "living",
  "bedroom",
  "kitchen",
  "hall",
  "bathroom",
  "wardrobe",
  "storage",
  "balcony",
] as const;

export type RoomKind = (typeof roomKinds)[number];

/** A decimal area with at most two places, kept as a string like `numeric` columns. */
export const areaSchema = z
  .string()
  .regex(/^\d{1,6}(\.\d{1,2})?$/, "Area must be a number with at most two decimals")
  .refine((value) => Number(value) > 0, "Area must be positive");

export const roomAreaSchema = z.object({
  kind: z.enum(roomKinds),
  area: areaSchema,
});

export type RoomArea = z.infer<typeof roomAreaSchema>;

/** ISO 4217 code; prices are stored in the currency's minor unit. */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
