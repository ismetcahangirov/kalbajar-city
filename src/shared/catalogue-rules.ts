import type { ApartmentListQuery } from "./apartments";

// What the catalogue's filter form and the API both follow, apart from
// `@/shared/apartments` because the form's first load has no use for zod
// (CLAUDE.md §5). `@/shared/apartments` re-exports them.

/**
 * The public site never lists `not_for_sale`: those apartments are kept back
 * by the developer and are not on offer.
 */
export const publicApartmentStatuses = ["available", "reserved", "sold"] as const;

export type PublicApartmentStatus = (typeof publicApartmentStatuses)[number];

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
