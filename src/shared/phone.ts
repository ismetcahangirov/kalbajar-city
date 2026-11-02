import { z } from "zod";

/** A phone number in E.164, as it is stored and sent over the API. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164, e.g. +994124343232");
