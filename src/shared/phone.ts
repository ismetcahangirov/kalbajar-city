import { z } from "zod";

import { e164Pattern, normalizePhone } from "./phone-format";

export { normalizePhone };

/** A phone number in E.164, as it is stored and sent over the API. */
export const phoneSchema = z
  .string()
  .regex(e164Pattern, "Phone must be in E.164, e.g. +994124343232");

/** A phone from a form: any notation `normalizePhone` accepts, stored as E.164. */
export const phoneInputSchema = z.preprocess(
  (value) => (typeof value === "string" ? (normalizePhone(value) ?? value) : value),
  phoneSchema,
);
