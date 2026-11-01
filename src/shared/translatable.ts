import { z } from "zod";

import type { Translatable } from "@/i18n/content";

/**
 * A translatable text field as it is stored in a `jsonb` column and sent over
 * the API. `az` is required; a blank `en` or `ru` means "not translated yet"
 * and falls back to `az` through `localize()` in `@/i18n/content`.
 */
export const translatableSchema = z.object({
  az: z.string().trim().min(1),
  en: z.string().trim().nullish(),
  ru: z.string().trim().nullish(),
}) satisfies z.ZodType<Translatable>;
