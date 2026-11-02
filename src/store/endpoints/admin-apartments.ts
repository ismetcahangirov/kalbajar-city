import type { Page } from "@/shared/api";
import type {
  AdminApartment,
  AdminApartmentListParams,
  ApartmentUpdate,
} from "@/shared/apartments";

import { baseApi, listTags } from "../api";

/**
 * The console's apartments (#24). A successful write invalidates the item and
 * every list, so open views refetch without a reload; the handler revalidates
 * the public pages' `inventory` tag on the server.
 */
export const adminApartmentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    adminApartments: build.query<Page<AdminApartment>, AdminApartmentListParams | void>({
      query: (params) => ({ url: "/admin/apartments", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "Apartment",
          result?.items.map((item) => item.id),
        ),
    }),
    adminApartment: build.query<AdminApartment, string>({
      query: (id) => `/admin/apartments/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Apartment", id }],
    }),
    updateApartment: build.mutation<AdminApartment, { id: string } & ApartmentUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/apartments/${id}`, method: "PATCH", body }),
      invalidatesTags: (result, error, { id }) =>
        error
          ? []
          : [
              { type: "Apartment", id },
              { type: "Apartment", id: "LIST" },
              // Public tags use the slug; layout counts change with the status.
              ...(result ? [{ type: "Apartment" as const, id: result.slug }] : []),
              { type: "LayoutType", id: "LIST" },
            ],
    }),
  }),
});

export const { useAdminApartmentsQuery, useAdminApartmentQuery, useUpdateApartmentMutation } =
  adminApartmentsApi;
