import { notFound } from "@/lib/api/errors";
import { handler } from "@/lib/api/handler";
import { getPublicApartment } from "@/lib/public/apartments";
import { apartmentSlugParamsSchema, localeOnlyQuerySchema } from "@/shared/apartments";

/** One apartment as its public page shows it. */
export const GET = handler(
  { params: apartmentSlugParamsSchema, query: localeOnlyQuerySchema },
  async ({ params, query }) => {
    const apartment = await getPublicApartment(params.slug, query.locale);
    if (!apartment) throw notFound("No such apartment.");
    return apartment;
  },
);
