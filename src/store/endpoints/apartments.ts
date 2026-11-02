import type { Page } from "@/shared/api";
import type {
  ApartmentListParams,
  PublicApartment,
  PublicApartmentDetail,
  PublicLayoutType,
} from "@/shared/apartments";
import type { Locale } from "@/i18n/routing";

import { baseApi, listTags } from "../api";

/** The public catalogue (#18) and the complex selector (#19). */
export const apartmentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    apartments: build.query<Page<PublicApartment>, ApartmentListParams | void>({
      query: (params) => ({ url: "/apartments", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "Apartment",
          result?.items.map((item) => item.slug),
        ),
    }),
    apartment: build.query<PublicApartmentDetail, { slug: string; locale?: Locale }>({
      query: ({ slug, locale }) => ({ url: `/apartments/${slug}`, params: { locale } }),
      providesTags: (_result, _error, { slug }) => [{ type: "Apartment", id: slug }],
    }),
    layoutTypes: build.query<PublicLayoutType[], { locale?: Locale } | void>({
      query: (params) => ({ url: "/layout-types", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "LayoutType",
          result?.map((item) => item.slug),
        ),
    }),
  }),
});

export const { useApartmentsQuery, useApartmentQuery, useLayoutTypesQuery } = apartmentsApi;
