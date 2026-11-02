import type { Page } from "@/shared/api";
import type {
  AdminApartment,
  AdminApartmentListParams,
  ApartmentBulk,
  ApartmentBulkResult,
  ApartmentCreate,
  ApartmentUpdate,
} from "@/shared/apartments";

import { baseApi, listTags } from "../api";
import { undoOnFailure } from "../optimistic";

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
      // A status change shows at once in every cached list and the item, and
      // is undone if the server refuses it. The price waits for the refetch.
      async onQueryStarted({ id, status }, { dispatch, getState, queryFulfilled }): Promise<void> {
        if (status === undefined) return;
        const { util } = adminApartmentsApi;
        const patches = [
          dispatch(
            util.updateQueryData("adminApartment", id, (draft) => {
              draft.status = status;
            }),
          ),
          ...util.selectCachedArgsForQuery(getState(), "adminApartments").map((args) =>
            dispatch(
              util.updateQueryData("adminApartments", args, (draft) => {
                const item = draft.items.find((entry) => entry.id === id);
                if (item) item.status = status;
              }),
            ),
          ),
        ];
        await undoOnFailure(queryFulfilled, patches);
      },
      invalidatesTags: (result, error, { id }) =>
        error
          ? []
          : [
              { type: "Apartment", id },
              { type: "Apartment", id: "LIST" },
              // Public tags use the slug; layout counts change with the status.
              ...(result ? [{ type: "Apartment" as const, id: result.slug }] : []),
              { type: "LayoutType", id: "LIST" },
              // Moving an apartment changes the structure's counts.
              { type: "Floor", id: "LIST" },
              { type: "Block", id: "LIST" },
            ],
    }),
    createApartment: build.mutation<AdminApartment, ApartmentCreate>({
      query: (body) => ({ url: "/admin/apartments", method: "POST", body }),
      invalidatesTags: (_result, error) =>
        error
          ? []
          : [
              { type: "Apartment", id: "LIST" },
              { type: "LayoutType", id: "LIST" },
              { type: "Floor", id: "LIST" },
              { type: "Block", id: "LIST" },
            ],
    }),
    deleteApartment: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/apartments/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error, id) =>
        error
          ? []
          : [
              { type: "Apartment", id },
              { type: "Apartment", id: "LIST" },
              { type: "LayoutType", id: "LIST" },
              { type: "Floor", id: "LIST" },
              { type: "Block", id: "LIST" },
            ],
    }),
    /** One change to the selected apartments, in one transaction (`PATCH /admin/apartments`). */
    bulkUpdateApartments: build.mutation<ApartmentBulkResult, ApartmentBulk>({
      query: (body) => ({ url: "/admin/apartments", method: "PATCH", body }),
      invalidatesTags: (_result, error, { ids }) =>
        error
          ? []
          : [
              ...ids.map((id) => ({ type: "Apartment" as const, id })),
              { type: "Apartment", id: "LIST" },
              { type: "LayoutType", id: "LIST" },
            ],
    }),
  }),
});

export const {
  useAdminApartmentsQuery,
  useAdminApartmentQuery,
  useUpdateApartmentMutation,
  useCreateApartmentMutation,
  useDeleteApartmentMutation,
  useBulkUpdateApartmentsMutation,
} = adminApartmentsApi;
