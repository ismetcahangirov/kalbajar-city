import type {
  AdminSelectorHotspot,
  AdminSelectorView,
  SelectorHotspotInput,
  SelectorPictureInput,
  SelectorViewQuery,
} from "@/shared/selector";

import { baseApi } from "../api";

/**
 * The complex selector's polygon editor (#19). One tag per level is enough:
 * the editor shows one level at a time. A view also lists blocks, floors and
 * apartments and shows a library picture, so structure, inventory and media
 * edits made elsewhere refresh it. A floor's picture is its plan, so setting
 * it also refreshes the structure page's floor list; the old and new pictures'
 * usages change, so every media tag goes.
 */
export const adminSelectorApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    selectorView: build.query<AdminSelectorView, SelectorViewQuery>({
      query: (params) => ({ url: "/admin/selector", params }),
      providesTags: (result) => [
        { type: "Selector", id: "VIEW" },
        { type: "Block", id: "LIST" },
        { type: "Floor", id: "LIST" },
        { type: "Apartment", id: "LIST" },
        ...(result?.picture ? [{ type: "Media" as const, id: result.picture.id }] : []),
      ],
    }),
    setSelectorPicture: build.mutation<AdminSelectorView, SelectorPictureInput>({
      query: (body) => ({ url: "/admin/selector/picture", method: "PUT", body }),
      invalidatesTags: (_result, error, { level }) =>
        error
          ? []
          : [
              { type: "Selector", id: "VIEW" },
              "Media",
              ...(level === "floor" ? [{ type: "Floor" as const, id: "LIST" }] : []),
            ],
    }),
    setSelectorHotspot: build.mutation<AdminSelectorHotspot, SelectorHotspotInput>({
      query: (body) => ({ url: "/admin/selector/hotspot", method: "PUT", body }),
      invalidatesTags: (_result, error) => (error ? [] : [{ type: "Selector", id: "VIEW" }]),
    }),
  }),
});

export const {
  useSelectorViewQuery,
  useSetSelectorPictureMutation,
  useSetSelectorHotspotMutation,
} = adminSelectorApi;
