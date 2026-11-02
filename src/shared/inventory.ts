import { z } from "zod";

import type { Translatable } from "@/i18n/content";

import { translatableSchema } from "./translatable";

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

/*
 * The console's inventory module (#24): buildings, blocks, floors and layout
 * types. Each endpoint parses its body with these schemas, and the console's
 * forms validate with the same ones, so typed values (`3`, `62,09`) are read
 * the same way on both ends.
 */

function blank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

/** A whole number typed into a form or sent as JSON; blank means "not given". */
export function intInput(min: number, max: number) {
  return z.preprocess(
    (value) =>
      blank(value) ? undefined : typeof value === "string" ? Number(value.trim()) : value,
    z.int().min(min).max(max),
  );
}

/** An area with a decimal point or, as typed in Azerbaijani, a decimal comma. */
export const areaInputSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replace(",", ".") : value),
  areaSchema,
);

/** A translatable text that may be left empty: every language blank is `null`. */
export const optionalTranslatableSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.values(record).every(blank) ? null : value;
}, translatableSchema.nullable());

/** `A`, `B2`: upper case on the way in, so `a` and `A` are one block. */
export const blockCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{1,8}$/, "Use up to 8 letters, digits or hyphens")
  .transform((value) => value.toUpperCase());

/** `3-111`: the code the console and the CSV name a layout by. */
export const layoutCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9.-]{1,16}$/, "Use up to 16 letters, digits, dots or hyphens");

export const floorNumberSchema = intInput(-5, 200);

const sortOrderSchema = intInput(0, 10_000);

const nonEmpty = (value: object) => Object.keys(value).length > 0;
const changeSomething = "Change at least one field";

/*
 * Each entity's fields are declared once without defaults: a create schema
 * adds them, and the update schema is the plain fields made optional. (zod
 * applies an inner `.default()` even under `.partial()`, so an update built
 * from a create schema would reset every field the request left out.)
 */

const buildingFields = { name: translatableSchema, sortOrder: sortOrderSchema };

export const buildingCreateSchema = z.strictObject({
  ...buildingFields,
  sortOrder: sortOrderSchema.default(0),
});

export type BuildingCreate = z.input<typeof buildingCreateSchema>;

export const buildingUpdateSchema = z
  .strictObject(buildingFields)
  .partial()
  .refine(nonEmpty, changeSomething);

export type BuildingUpdate = z.input<typeof buildingUpdateSchema>;

const blockFields = {
  buildingId: z.uuid(),
  code: blockCodeSchema,
  name: translatableSchema,
  sortOrder: sortOrderSchema,
};

export const blockCreateSchema = z.strictObject({
  ...blockFields,
  sortOrder: sortOrderSchema.default(0),
});

export type BlockCreate = z.input<typeof blockCreateSchema>;

export const blockUpdateSchema = z
  .strictObject(blockFields)
  .partial()
  .refine(nonEmpty, changeSomething);

export type BlockUpdate = z.input<typeof blockUpdateSchema>;

const floorFields = {
  number: floorNumberSchema,
  /** The floor's plan, an image from the media library. */
  planMediaId: z.uuid().nullable(),
};

export const floorCreateSchema = z.strictObject({
  blockId: z.uuid(),
  ...floorFields,
  planMediaId: floorFields.planMediaId.default(null),
});

export type FloorCreate = z.input<typeof floorCreateSchema>;

/** A floor stays in its block; its number and plan may change. */
export const floorUpdateSchema = z
  .strictObject(floorFields)
  .partial()
  .refine(nonEmpty, changeSomething);

export type FloorUpdate = z.input<typeof floorUpdateSchema>;

/** `GET /api/v1/admin/floors`: one block's floors, or every floor. */
export const floorListQuerySchema = z.object({ block: z.uuid().optional() });

const layoutFields = {
  code: layoutCodeSchema,
  rooms: intInput(1, 10),
  areaTotal: areaInputSchema,
  roomAreas: z.array(z.object({ kind: z.enum(roomKinds), area: areaInputSchema })).max(30),
  planMediaId: z.uuid().nullable(),
  description: optionalTranslatableSchema,
  sortOrder: sortOrderSchema,
};

export const layoutTypeCreateSchema = z.strictObject({
  ...layoutFields,
  roomAreas: layoutFields.roomAreas.default([]),
  planMediaId: layoutFields.planMediaId.default(null),
  description: layoutFields.description.default(null),
  sortOrder: sortOrderSchema.default(0),
});

export type LayoutTypeCreate = z.input<typeof layoutTypeCreateSchema>;

export const layoutTypeUpdateSchema = z
  .strictObject(layoutFields)
  .partial()
  .refine(nonEmpty, changeSomething);

export type LayoutTypeUpdate = z.input<typeof layoutTypeUpdateSchema>;

export const inventoryIdParamsSchema = z.object({ id: z.uuid() });

/** A plan image as the console shows it: a small preview and its alt text. */
export type AdminPlan = { id: string; previewUrl: string | null; alt: string | null };

export type AdminBuilding = {
  id: string;
  slug: string;
  name: Translatable;
  sortOrder: number;
  isDemo: boolean;
  blocks: number;
};

export type AdminBlock = {
  id: string;
  slug: string;
  buildingId: string;
  code: string;
  name: Translatable;
  sortOrder: number;
  isDemo: boolean;
  floors: number;
  apartments: number;
};

export type AdminFloor = {
  id: string;
  blockId: string;
  blockCode: string;
  number: number;
  plan: AdminPlan | null;
  isDemo: boolean;
  apartments: number;
};

export type AdminLayoutType = {
  id: string;
  slug: string;
  code: string;
  rooms: number;
  areaTotal: string;
  roomAreas: RoomArea[];
  plan: AdminPlan | null;
  description: Translatable | null;
  sortOrder: number;
  apartments: number;
};

/** The 409 a delete answers while other rows still use the entity. */
export const inUseCode = "IN_USE";

/**
 * A price typed in manat (`125 000`, `99 999,50`, `125000.5`) as a string of
 * qəpik, `null` when left empty, or `undefined` when it is not a price. A
 * single `,` or `.` is the decimal separator, so `125,000` (three decimals)
 * is refused rather than guessed.
 */
export function aznToMinor(input: string): string | null | undefined {
  const text = input.replace(/[\s\u00a0\u202f_]/g, "").replace(/(AZN|₼|manat)$/i, "");
  if (!text) return null;
  const match = /^(\d{1,13})(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return undefined;
  const [, whole = "0", fraction = ""] = match;
  return String(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}

/** Qəpik back to what a person types: `125000`, `99999,50`. */
export function minorToAzn(minor: string | null): string {
  if (minor === null) return "";
  const value = BigInt(minor);
  const whole = value / 100n;
  const fraction = value % 100n;
  return fraction === 0n ? String(whole) : `${whole},${String(fraction).padStart(2, "0")}`;
}

/** A price field in AZN, as the forms and the CSV read it. */
export const aznInputSchema = z.string().transform((value, ctx): string | null => {
  const minor = aznToMinor(value);
  if (minor === undefined) {
    ctx.addIssue({ code: "custom", message: "Give the price in AZN" });
    return z.NEVER;
  }
  return minor;
});
