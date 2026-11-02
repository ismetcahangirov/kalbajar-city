import type {
  AdminBlock,
  AdminBuilding,
  AdminFloor,
  AdminLayoutType,
  BlockCreate,
  BlockUpdate,
  BuildingCreate,
  BuildingUpdate,
  FloorCreate,
  FloorUpdate,
  LayoutTypeCreate,
  LayoutTypeUpdate,
} from "@/shared/inventory";
import type { ImportReport, ImportRequest } from "@/shared/inventory-csv";

import { baseApi, listTags, type TagType } from "../api";

const lists = (...types: TagType[]) => types.map((type) => ({ type, id: "LIST" }));

/**
 * The inventory's structure (#24): buildings, blocks, floors and layout
 * types, and the CSV import. Counts and codes show in each other's lists, so
 * a write invalidates every list it changes; the handlers revalidate the
 * public pages' `inventory` tag on the server.
 */
export const adminInventoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    buildings: build.query<AdminBuilding[], void>({
      query: () => "/admin/buildings",
      providesTags: (result) =>
        listTags(
          "Building",
          result?.map((item) => item.id),
        ),
    }),
    createBuilding: build.mutation<AdminBuilding, BuildingCreate>({
      query: (body) => ({ url: "/admin/buildings", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Building")),
    }),
    updateBuilding: build.mutation<AdminBuilding, { id: string } & BuildingUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/buildings/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Building", "Block")),
    }),
    deleteBuilding: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/buildings/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Building")),
    }),

    blocks: build.query<AdminBlock[], void>({
      query: () => "/admin/blocks",
      providesTags: (result) =>
        listTags(
          "Block",
          result?.map((item) => item.id),
        ),
    }),
    createBlock: build.mutation<AdminBlock, BlockCreate>({
      query: (body) => ({ url: "/admin/blocks", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Block", "Building")),
    }),
    updateBlock: build.mutation<AdminBlock, { id: string } & BlockUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/blocks/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error) =>
        error ? [] : lists("Block", "Building", "Floor", "Apartment"),
    }),
    deleteBlock: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/blocks/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Block", "Building")),
    }),

    floors: build.query<AdminFloor[], { block?: string } | void>({
      query: (params) => ({ url: "/admin/floors", params: params ?? undefined }),
      providesTags: (result) =>
        listTags(
          "Floor",
          result?.map((item) => item.id),
        ),
    }),
    createFloor: build.mutation<AdminFloor, FloorCreate>({
      query: (body) => ({ url: "/admin/floors", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Floor", "Block")),
    }),
    updateFloor: build.mutation<AdminFloor, { id: string } & FloorUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/floors/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Floor", "Apartment")),
    }),
    deleteFloor: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/floors/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : lists("Floor", "Block")),
    }),

    adminLayoutTypes: build.query<AdminLayoutType[], void>({
      query: () => "/admin/layout-types",
      providesTags: (result) =>
        listTags(
          "LayoutType",
          result?.map((item) => item.id),
        ),
    }),
    createLayoutType: build.mutation<AdminLayoutType, LayoutTypeCreate>({
      query: (body) => ({ url: "/admin/layout-types", method: "POST", body }),
      invalidatesTags: (_result, error) => (error ? [] : lists("LayoutType")),
    }),
    updateLayoutType: build.mutation<AdminLayoutType, { id: string } & LayoutTypeUpdate>({
      query: ({ id, ...body }) => ({ url: `/admin/layout-types/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, error, { id }) =>
        error ? [] : [{ type: "LayoutType", id }, ...lists("LayoutType", "Apartment")],
    }),
    deleteLayoutType: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/layout-types/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : lists("LayoutType")),
    }),

    /**
     * A dry run changes nothing and invalidates nothing; a real run may touch
     * every list. A file with invalid rows answers 422 `IMPORT_INVALID` with
     * the report in the error body (`importReportOf`).
     */
    importApartments: build.mutation<ImportReport, ImportRequest>({
      query: (body) => ({ url: "/admin/apartments/import", method: "POST", body }),
      invalidatesTags: (result) =>
        result?.applied ? lists("Apartment", "Floor", "Block", "Building", "LayoutType") : [],
    }),
  }),
});

/** The report a refused import carries in its error body (422 or 409). */
export function importReportOf(error: unknown): ImportReport | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const body = (error as { data?: { error?: { report?: ImportReport } } }).data;
  return body?.error?.report ?? null;
}

export const {
  useBuildingsQuery,
  useCreateBuildingMutation,
  useUpdateBuildingMutation,
  useDeleteBuildingMutation,
  useBlocksQuery,
  useCreateBlockMutation,
  useUpdateBlockMutation,
  useDeleteBlockMutation,
  useFloorsQuery,
  useCreateFloorMutation,
  useUpdateFloorMutation,
  useDeleteFloorMutation,
  useAdminLayoutTypesQuery,
  useCreateLayoutTypeMutation,
  useUpdateLayoutTypeMutation,
  useDeleteLayoutTypeMutation,
  useImportApartmentsMutation,
} = adminInventoryApi;
