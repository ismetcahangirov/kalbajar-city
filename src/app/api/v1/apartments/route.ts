import { handler } from "@/lib/api/handler";
import { listPublicApartments } from "@/lib/public/apartments";
import { apartmentListQuerySchema } from "@/shared/apartments";

/** The catalogue, filtered, sorted and paginated (`ApartmentListParams`). */
export const GET = handler({ query: apartmentListQuerySchema }, ({ query }) =>
  listPublicApartments(query),
);
